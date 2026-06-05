import { getAppAccessToken } from './auth';
import { chunkArray } from '../db/d1-batch';
import { HelixRateBudget, helixRateLimitExceeded, helixRateLimitWaitMs, sleepMs } from './rate-limit';
import { helixPhaseBudgetFromEnv } from './helix-budget';
import { STREAMS_BATCH_SIZE } from './config';
import { twitchClientId } from '../worker-bindings';

export type HelixStream = {
	id: string;
	user_id: string;
	user_login: string;
	user_name: string;
	game_id: string;
	game_name: string;
	title: string;
	viewer_count: number;
	started_at: string;
	type: string;
	language?: string;
	tags?: string[];
	thumbnail_url?: string;
	/** Deprecated on Helix; not persisted. */
	is_mature?: boolean;
};

export type HelixGame = {
	id: string;
	name: string;
	box_art_url: string;
};

/** GET /helix/users — broadcaster profile (not on Stream object). */
export type HelixUser = {
	id: string;
	login: string;
	display_name: string;
	type: string;
	broadcaster_type: string;
	description: string;
	profile_image_url: string;
	offline_image_url?: string;
	view_count?: number;
	created_at: string;
};

/** GET /helix/channels — offline channel shell (title, game, tags). */
export type HelixChannel = {
	broadcaster_id: string;
	broadcaster_login: string;
	broadcaster_name: string;
	game_id: string;
	game_name: string;
	title: string;
	tags: string[];
	delay?: number;
	content_classification_labels?: string[];
	is_branded_content?: boolean;
};

type HelixListResponse<T> = {
	data: T[];
	pagination?: { cursor?: string };
	total?: number;
};

export type HelixChannelFollowersResponse = {
	total: number;
	data: unknown[];
};

export type TwitchHelixClientOptions = {
	/** Per-isolate budget cap. Default: phase budget for parallel queue consumers. */
	budgetPoints?: number;
};

/** Max 429 / Ratelimit-Remaining=0 retries after the first Helix attempt before throwing. */
export const HELIX_429_MAX_RETRIES = 5;

function helixRateLimited(res: Response): boolean {
	return res.status === 429 || helixRateLimitExceeded(res.headers);
}

export class TwitchHelixClient {
	private readonly budget: HelixRateBudget;

	constructor(private readonly env: Env, opts: TwitchHelixClientOptions = {}) {
		this.budget = new HelixRateBudget(opts.budgetPoints ?? helixPhaseBudgetFromEnv(env));
	}

	getBudget(): HelixRateBudget {
		return this.budget;
	}

	async getTopGames(first = 100): Promise<HelixGame[]> {
		const json = await this.get<HelixListResponse<HelixGame>>('/games/top', { first: String(first) });
		return json.data ?? [];
	}

	/** All live streams, viewer count descending (global directory). */
	async getLiveStreamsPage(
		opts: { first?: number; after?: string } = {}
	): Promise<HelixListResponse<HelixStream>> {
		const params: Record<string, string> = {
			first: String(opts.first ?? STREAMS_BATCH_SIZE)
		};
		if (opts.after) params.after = opts.after;
		return this.get<HelixListResponse<HelixStream>>('/streams', params);
	}

	async getStreamsByGameId(
		gameId: string,
		opts: { first?: number; after?: string } = {}
	): Promise<HelixListResponse<HelixStream>> {
		const params: Record<string, string> = {
			game_id: gameId,
			first: String(opts.first ?? 100)
		};
		if (opts.after) params.after = opts.after;
		return this.get<HelixListResponse<HelixStream>>('/streams', params);
	}

	async getStreamsByUserIds(userIds: string[]): Promise<HelixStream[]> {
		if (userIds.length === 0) return [];
		const chunks = chunkArray(userIds, STREAMS_BATCH_SIZE);
		const out: HelixStream[] = [];
		for (const ids of chunks) {
			out.push(...(await this.getStreamsBatch(ids)));
		}
		return out;
	}

	/** Batch GET /users?id=… (max 100 per request, 1 point). */
	async getUsersByIds(userIds: string[]): Promise<HelixUser[]> {
		if (userIds.length === 0) return [];
		const chunks = chunkArray(userIds, STREAMS_BATCH_SIZE);
		const out: HelixUser[] = [];
		for (const ids of chunks) {
			out.push(...(await this.getUsersBatch(ids)));
		}
		return out;
	}

	/** Batch GET /users?login=… (max 100 per request, 1 point). */
	async getUsersByLogins(logins: string[]): Promise<HelixUser[]> {
		if (logins.length === 0) return [];
		const chunks = chunkArray(logins, STREAMS_BATCH_SIZE);
		const out: HelixUser[] = [];
		for (const batch of chunks) {
			out.push(...(await this.getUsersByLoginsBatch(batch)));
		}
		return out;
	}

	/**
	 * Public follower total per broadcaster (app token → `total` only).
	 * @see https://dev.twitch.tv/docs/api/reference#get-channel-followers
	 */
	async getChannelFollowerTotals(
		broadcasterIds: string[]
	): Promise<Map<string, number>> {
		const out = new Map<string, number>();
		for (const id of broadcasterIds) {
			const total = await this.getChannelFollowerTotal(id);
			if (total != null) out.set(id, total);
		}
		return out;
	}

	async getChannelFollowerTotal(
		broadcasterId: string,
		rateLimitRetries = 0
	): Promise<number | null> {
		const token = await getAppAccessToken(this.env, this.budget);
		await this.budget.consume(1);

		const url = new URL('https://api.twitch.tv/helix/channels/followers');
		url.searchParams.set('broadcaster_id', broadcasterId);

		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Client-Id': twitchClientId(this.env)
			}
		});

		this.budget.applyHeaders(res.headers);

		if (helixRateLimited(res)) {
			if (rateLimitRetries >= HELIX_429_MAX_RETRIES) {
				throw new Error(
					`Helix /channels/followers rate limited after ${HELIX_429_MAX_RETRIES} retries`
				);
			}
			await sleepMs(helixRateLimitWaitMs(res.headers));
			return this.getChannelFollowerTotal(broadcasterId, rateLimitRetries + 1);
		}

		if (!res.ok) {
			return null;
		}

		const json = (await res.json()) as HelixChannelFollowersResponse;
		return typeof json.total === 'number' ? json.total : null;
	}

	/** Batch GET /channels?broadcaster_id=… (max 100 per request, 1 point). */
	async getChannelsByBroadcasterIds(broadcasterIds: string[]): Promise<HelixChannel[]> {
		if (broadcasterIds.length === 0) return [];
		const chunks = chunkArray(broadcasterIds, STREAMS_BATCH_SIZE);
		const out: HelixChannel[] = [];
		for (const ids of chunks) {
			out.push(...(await this.getChannelsBatch(ids)));
		}
		return out;
	}

	private async getUsersBatch(userIds: string[]): Promise<HelixUser[]> {
		return this.getIdListBatch<HelixUser>('/users', 'id', userIds);
	}

	private async getUsersByLoginsBatch(logins: string[]): Promise<HelixUser[]> {
		return this.getIdListBatch<HelixUser>('/users', 'login', logins);
	}

	private async getChannelsBatch(broadcasterIds: string[]): Promise<HelixChannel[]> {
		return this.getIdListBatch<HelixChannel>('/channels', 'broadcaster_id', broadcasterIds);
	}

	private async getIdListBatch<T>(
		path: string,
		param: string,
		ids: string[],
		rateLimitRetries = 0
	): Promise<T[]> {
		const token = await getAppAccessToken(this.env, this.budget);
		await this.budget.consume(1);

		const url = new URL(`https://api.twitch.tv/helix${path}`);
		for (const id of ids) {
			url.searchParams.append(param, id);
		}

		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Client-Id': twitchClientId(this.env)
			}
		});

		this.budget.applyHeaders(res.headers);

		if (helixRateLimited(res)) {
			if (rateLimitRetries >= HELIX_429_MAX_RETRIES) {
				const text = await res.text();
				throw new Error(
					`Helix ${path} rate limited after ${HELIX_429_MAX_RETRIES} retries: ${text.slice(0, 300)}`
				);
			}
			await sleepMs(helixRateLimitWaitMs(res.headers));
			return this.getIdListBatch<T>(path, param, ids, rateLimitRetries + 1);
		}

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Helix ${path} ${res.status}: ${text.slice(0, 300)}`);
		}

		const json = (await res.json()) as HelixListResponse<T>;
		return json.data ?? [];
	}

	private async getStreamsBatch(userIds: string[], rateLimitRetries = 0): Promise<HelixStream[]> {
		const token = await getAppAccessToken(this.env, this.budget);
		await this.budget.consume(1);

		const url = new URL('https://api.twitch.tv/helix/streams');
		url.searchParams.set('first', String(Math.min(userIds.length, STREAMS_BATCH_SIZE)));
		for (const id of userIds) {
			url.searchParams.append('user_id', id);
		}

		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Client-Id': twitchClientId(this.env)
			}
		});

		this.budget.applyHeaders(res.headers);

		if (helixRateLimited(res)) {
			if (rateLimitRetries >= HELIX_429_MAX_RETRIES) {
				const text = await res.text();
				throw new Error(
					`Helix /streams rate limited after ${HELIX_429_MAX_RETRIES} retries: ${text.slice(0, 300)}`
				);
			}
			await sleepMs(helixRateLimitWaitMs(res.headers));
			return this.getStreamsBatch(userIds, rateLimitRetries + 1);
		}

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Helix /streams ${res.status}: ${text.slice(0, 300)}`);
		}

		const json = (await res.json()) as HelixListResponse<HelixStream>;
		return json.data ?? [];
	}

	private async get<T>(
		path: string,
		query: Record<string, string>,
		rateLimitRetries = 0
	): Promise<T> {
		const token = await getAppAccessToken(this.env, this.budget);
		await this.budget.consume(1);

		const url = new URL(`https://api.twitch.tv/helix${path}`);
		for (const [k, v] of Object.entries(query)) {
			url.searchParams.set(k, v);
		}

		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Client-Id': twitchClientId(this.env)
			}
		});

		this.budget.applyHeaders(res.headers);

		if (helixRateLimited(res)) {
			if (rateLimitRetries >= HELIX_429_MAX_RETRIES) {
				const text = await res.text();
				throw new Error(
					`Helix ${path} rate limited after ${HELIX_429_MAX_RETRIES} retries: ${text.slice(0, 300)}`
				);
			}
			await sleepMs(helixRateLimitWaitMs(res.headers));
			return this.get<T>(path, query, rateLimitRetries + 1);
		}

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Helix ${path} ${res.status}: ${text.slice(0, 300)}`);
		}

		return (await res.json()) as T;
	}
}
