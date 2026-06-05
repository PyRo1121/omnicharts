import { getKickAppAccessToken, invalidateKickTokenCache } from './auth';
import { KICK_API_BASE, KICK_LIVESTREAMS_BATCH_SIZE } from './config';
import { KickRateBudget, kickRetryAfterMs, sleepMs } from './rate-limit';
import type {
	KickApiListResponse,
	KickCategoryWithTags,
	KickChannel,
	KickLivestream,
	KickPaginatedResponse
} from './types';
import { chunkArray } from '../db/d1-batch';

const KICK_429_MAX_RETRIES = 5;

export type KickPublicApiClientOptions = {
	budget?: KickRateBudget;
};

export class KickPublicApiClient {
	private readonly budget: KickRateBudget;

	constructor(private readonly env: Env, opts: KickPublicApiClientOptions = {}) {
		this.budget = opts.budget ?? new KickRateBudget();
	}

	getBudget(): KickRateBudget {
		return this.budget;
	}

	async getCategoriesV2(opts: {
		cursor?: string;
		limit?: number;
	} = {}): Promise<KickPaginatedResponse<KickCategoryWithTags>> {
		const params = new URLSearchParams();
		if (opts.cursor) params.set('cursor', opts.cursor);
		params.set('limit', String(opts.limit ?? 100));
		return this.get<KickPaginatedResponse<KickCategoryWithTags>>('/public/v2/categories', params);
	}

	async getLivestreamsByCategoryId(
		categoryId: number,
		opts: { limit?: number; sort?: 'viewer_count' | 'started_at' } = {}
	): Promise<KickLivestream[]> {
		const params = new URLSearchParams();
		params.set('category_id', String(categoryId));
		params.set('limit', String(opts.limit ?? 100));
		params.set('sort', opts.sort ?? 'viewer_count');

		const json = await this.get<KickApiListResponse<KickLivestream>>(
			'/public/v1/livestreams',
			params
		);
		return json.data ?? [];
	}

	async getChannelsBySlug(slug: string): Promise<KickChannel[]> {
		const trimmed = slug.trim();
		if (!trimmed) return [];

		const params = new URLSearchParams();
		params.set('slug', trimmed);

		const json = await this.get<KickApiListResponse<KickChannel>>('/public/v1/channels', params);
		return json.data ?? [];
	}

	async getLivestreamsByBroadcasterIds(broadcasterIds: string[]): Promise<KickLivestream[]> {
		if (broadcasterIds.length === 0) return [];
		const chunks = chunkArray(broadcasterIds, KICK_LIVESTREAMS_BATCH_SIZE);
		const out: KickLivestream[] = [];
		for (const ids of chunks) {
			out.push(...(await this.getLivestreamsBatch(ids)));
		}
		return out;
	}

	private async getLivestreamsBatch(broadcasterIds: string[]): Promise<KickLivestream[]> {
		const params = new URLSearchParams();
		for (const id of broadcasterIds) {
			params.append('broadcaster_user_id', id);
		}
		params.set('sort', 'viewer_count');

		const json = await this.get<KickApiListResponse<KickLivestream>>(
			'/public/v1/livestreams',
			params
		);
		return json.data ?? [];
	}

	private async get<T>(path: string, params?: URLSearchParams): Promise<T> {
		await this.budget.consume(1);

		const url = new URL(path, KICK_API_BASE);
		if (params) {
			url.search = params.toString();
		}

		for (let attempt = 0; attempt <= KICK_429_MAX_RETRIES; attempt++) {
			const token = await getKickAppAccessToken(this.env);
			const res = await fetch(url.toString(), {
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json'
				}
			});

			if (res.status === 401 && attempt === 0) {
				invalidateKickTokenCache();
				continue;
			}

			if (res.status === 429 && attempt < KICK_429_MAX_RETRIES) {
				await sleepMs(kickRetryAfterMs(res.headers));
				continue;
			}

			if (!res.ok) {
				const text = await res.text();
				throw new Error(`Kick API ${path} failed ${res.status}: ${text.slice(0, 200)}`);
			}

			return (await res.json()) as T;
		}

		throw new Error(`Kick API ${path} rate limited after retries`);
	}
}
