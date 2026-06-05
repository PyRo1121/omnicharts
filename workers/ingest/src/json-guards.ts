/** Runtime checks for untyped JSON — keeps API clients free of unsafe assertions. */

import type { HelixChannelFollowersResponse, HelixChannel, HelixGame, HelixStream, HelixUser, HelixVideo } from './twitch/helix';
import type { EventSubWebhookBody, HelixEventSubSubscription, StreamOnlineEvent } from './twitch/eventsub/types';
import type { KickCategory, KickCategoryWithTags, KickChannel, KickLivestream } from './kick/types';
import type {
	YoutubeChannelItem,
	YoutubeChannelListResponse,
	YoutubePlaylistItem,
	YoutubePlaylistItemsResponse,
	YoutubeVideoItem,
	YoutubeVideoListResponse,
} from './youtube/types';

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === 'string' ? value : undefined;
}

export function readNumber(record: Record<string, unknown>, key: string): number | undefined {
	const value = record[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
	const value = record[key];
	return typeof value === 'boolean' ? value : undefined;
}

export function readArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
	const value = record[key];
	return Array.isArray(value) ? value : undefined;
}

function readStringOrNumber(record: Record<string, unknown>, key: string): string | number | undefined {
	const value = record[key];
	return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

export function readStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
	const value = record[key];
	if (!Array.isArray(value)) return undefined;
	return value.every((item) => typeof item === 'string') ? value : undefined;
}

export type OAuthTokenResponse = {
	access_token: string;
	expires_in: number;
};

export function parseOAuthTokenResponse(data: unknown): OAuthTokenResponse {
	if (!isRecord(data)) throw new Error('Invalid OAuth token response');
	const access_token = readString(data, 'access_token');
	const expires_in = readNumber(data, 'expires_in');
	if (!access_token || expires_in == null) throw new Error('Invalid OAuth token response shape');
	return { access_token, expires_in };
}

export type HelixListJson = {
	data: unknown[];
	pagination?: { cursor?: string };
	total?: number;
};

function parseHelixPagination(record: Record<string, unknown>): { cursor?: string } | undefined {
	const pagination = record.pagination;
	if (!isRecord(pagination)) return undefined;
	const cursor = readString(pagination, 'cursor');
	return cursor ? { cursor } : {};
}

export function parseHelixListResponse(data: unknown): HelixListJson {
	if (!isRecord(data)) throw new Error('Invalid Helix list response');
	return {
		data: readArray(data, 'data') ?? [],
		pagination: parseHelixPagination(data),
		total: readNumber(data, 'total'),
	};
}

export function parseHelixChannelFollowersResponse(data: unknown): HelixChannelFollowersResponse {
	if (!isRecord(data)) throw new Error('Invalid Helix followers response');
	return {
		total: readNumber(data, 'total') ?? 0,
		data: readArray(data, 'data') ?? [],
	};
}

function requireString(record: Record<string, unknown>, key: string): string | null {
	const value = readString(record, key);
	return value ?? null;
}

export function parseHelixGame(item: unknown): HelixGame | null {
	if (!isRecord(item)) return null;
	const id = requireString(item, 'id');
	const name = requireString(item, 'name');
	const box_art_url = requireString(item, 'box_art_url');
	if (!id || !name || !box_art_url) return null;
	return { id, name, box_art_url };
}

export function parseHelixStream(item: unknown): HelixStream | null {
	if (!isRecord(item)) return null;
	const id = requireString(item, 'id');
	const user_id = requireString(item, 'user_id');
	const user_login = requireString(item, 'user_login');
	const user_name = requireString(item, 'user_name');
	const game_id = requireString(item, 'game_id');
	const game_name = requireString(item, 'game_name');
	const title = requireString(item, 'title');
	const viewer_count = readNumber(item, 'viewer_count');
	const started_at = requireString(item, 'started_at');
	const type = requireString(item, 'type');
	if (!id || !user_id || !user_login || !user_name || !game_id || !game_name || !title || viewer_count == null || !started_at || !type) {
		return null;
	}
	const stream: HelixStream = {
		id,
		user_id,
		user_login,
		user_name,
		game_id,
		game_name,
		title,
		viewer_count,
		started_at,
		type,
	};
	const language = readString(item, 'language');
	if (language) stream.language = language;
	const tags = readStringArray(item, 'tags');
	if (tags) stream.tags = tags;
	const thumbnail_url = readString(item, 'thumbnail_url');
	if (thumbnail_url) stream.thumbnail_url = thumbnail_url;
	const is_mature = readBoolean(item, 'is_mature');
	if (is_mature != null) stream.is_mature = is_mature;
	return stream;
}

export function parseHelixUser(item: unknown): HelixUser | null {
	if (!isRecord(item)) return null;
	const id = requireString(item, 'id');
	const login = requireString(item, 'login');
	const display_name = requireString(item, 'display_name');
	const type = requireString(item, 'type');
	const broadcaster_type = requireString(item, 'broadcaster_type');
	const description = requireString(item, 'description');
	const profile_image_url = requireString(item, 'profile_image_url');
	const created_at = requireString(item, 'created_at');
	if (!id || !login || !display_name || !type || !broadcaster_type || !description || !profile_image_url || !created_at) {
		return null;
	}
	const user: HelixUser = {
		id,
		login,
		display_name,
		type,
		broadcaster_type,
		description,
		profile_image_url,
		created_at,
	};
	const offline_image_url = readString(item, 'offline_image_url');
	if (offline_image_url) user.offline_image_url = offline_image_url;
	const view_count = readNumber(item, 'view_count');
	if (view_count != null) user.view_count = view_count;
	return user;
}

export function parseHelixChannel(item: unknown): HelixChannel | null {
	if (!isRecord(item)) return null;
	const broadcaster_id = requireString(item, 'broadcaster_id');
	const broadcaster_login = requireString(item, 'broadcaster_login');
	const broadcaster_name = requireString(item, 'broadcaster_name');
	const game_id = requireString(item, 'game_id');
	const game_name = requireString(item, 'game_name');
	const title = requireString(item, 'title');
	const tags = readStringArray(item, 'tags');
	if (!broadcaster_id || !broadcaster_login || !broadcaster_name || !game_id || !game_name || !title || !tags) {
		return null;
	}
	const channel: HelixChannel = {
		broadcaster_id,
		broadcaster_login,
		broadcaster_name,
		game_id,
		game_name,
		title,
		tags,
	};
	const delay = readNumber(item, 'delay');
	if (delay != null) channel.delay = delay;
	return channel;
}

export function parseHelixVideo(item: unknown): HelixVideo | null {
	if (!isRecord(item)) return null;
	const id = requireString(item, 'id');
	const user_id = requireString(item, 'user_id');
	const user_login = requireString(item, 'user_login');
	const user_name = requireString(item, 'user_name');
	const title = requireString(item, 'title');
	const description = requireString(item, 'description');
	const created_at = requireString(item, 'created_at');
	const published_at = requireString(item, 'published_at');
	const url = requireString(item, 'url');
	const thumbnail_url = requireString(item, 'thumbnail_url');
	const viewable = requireString(item, 'viewable');
	const view_count = readNumber(item, 'view_count');
	const language = requireString(item, 'language');
	const type = requireString(item, 'type');
	const duration = requireString(item, 'duration');
	if (
		!id ||
		!user_id ||
		!user_login ||
		!user_name ||
		!title ||
		!description ||
		!created_at ||
		!published_at ||
		!url ||
		!thumbnail_url ||
		!viewable ||
		view_count == null ||
		!language ||
		!type ||
		!duration
	) {
		return null;
	}
	return {
		id,
		user_id,
		user_login,
		user_name,
		title,
		description,
		created_at,
		published_at,
		url,
		thumbnail_url,
		viewable,
		view_count,
		language,
		type,
		duration,
	};
}

function parseHelixEventSubSubscription(item: unknown): HelixEventSubSubscription | null {
	if (!isRecord(item)) return null;
	const id = requireString(item, 'id');
	const type = requireString(item, 'type');
	const version = requireString(item, 'version');
	const status = requireString(item, 'status');
	const cost = readNumber(item, 'cost');
	const created_at = requireString(item, 'created_at');
	const conditionRaw = item.condition;
	const transportRaw = item.transport;
	if (!id || !type || !version || !status || cost == null || !created_at || !isRecord(conditionRaw) || !isRecord(transportRaw)) {
		return null;
	}
	const broadcaster_user_id = readString(conditionRaw, 'broadcaster_user_id');
	const method = readString(transportRaw, 'method');
	const callback = readString(transportRaw, 'callback');
	if (!broadcaster_user_id || !method || !callback) return null;
	return {
		id,
		type,
		version,
		status,
		cost,
		created_at,
		condition: { broadcaster_user_id },
		transport: { method, callback },
	};
}

export type HelixEventSubListJson = {
	data: HelixEventSubSubscription[];
	pagination?: { cursor?: string };
	total: number;
	total_cost: number;
	max_total_cost: number;
};

export function parseHelixEventSubListResponse(data: unknown): HelixEventSubListJson {
	if (!isRecord(data)) throw new Error('Invalid EventSub list response');
	const rawData = readArray(data, 'data') ?? [];
	return {
		data: rawData.map(parseHelixEventSubSubscription).filter((row): row is HelixEventSubSubscription => row !== null),
		pagination: parseHelixPagination(data),
		total: readNumber(data, 'total') ?? 0,
		total_cost: readNumber(data, 'total_cost') ?? 0,
		max_total_cost: readNumber(data, 'max_total_cost') ?? 0,
	};
}

export type HelixEventSubCreateJson = {
	data: HelixEventSubSubscription[];
	total: number;
	total_cost: number;
	max_total_cost: number;
};

export function parseHelixEventSubCreateResponse(data: unknown): HelixEventSubCreateJson | null {
	if (!isRecord(data)) return null;
	const rawData = readArray(data, 'data');
	if (!rawData) return null;
	return {
		data: rawData.map(parseHelixEventSubSubscription).filter((row): row is HelixEventSubSubscription => row !== null),
		total: readNumber(data, 'total') ?? 0,
		total_cost: readNumber(data, 'total_cost') ?? 0,
		max_total_cost: readNumber(data, 'max_total_cost') ?? 0,
	};
}

export function parseEventSubWebhookBody(data: unknown): EventSubWebhookBody | null {
	if (!isRecord(data)) return null;
	const body: EventSubWebhookBody = {};
	const challenge = readString(data, 'challenge');
	if (challenge) body.challenge = challenge;
	const subscriptionRaw = data.subscription;
	if (isRecord(subscriptionRaw)) {
		const id = readString(subscriptionRaw, 'id');
		const type = readString(subscriptionRaw, 'type');
		const status = readString(subscriptionRaw, 'status');
		if (id && type && status) {
			const conditionRaw = subscriptionRaw.condition;
			body.subscription = {
				id,
				type,
				status,
				condition: isRecord(conditionRaw)
					? { broadcaster_user_id: readString(conditionRaw, 'broadcaster_user_id') }
					: undefined,
			};
		}
	}
	const event = data.event;
	if (isRecord(event)) body.event = event;
	return body;
}

export function parseStreamOnlineEvent(event: Record<string, unknown>): StreamOnlineEvent | null {
	const id = readString(event, 'id');
	const broadcaster_user_id = readString(event, 'broadcaster_user_id');
	const broadcaster_user_login = readString(event, 'broadcaster_user_login');
	const broadcaster_user_name = readString(event, 'broadcaster_user_name');
	const started_at = readString(event, 'started_at');
	if (!id || !broadcaster_user_id || !broadcaster_user_login || !broadcaster_user_name || !started_at) return null;
	return {
		id,
		broadcaster_user_id,
		broadcaster_user_login,
		broadcaster_user_name,
		type: readString(event, 'type') ?? 'live',
		started_at,
	};
}

export function parseKickCategory(item: unknown): KickCategory | null {
	if (!isRecord(item)) return null;
	const id = readNumber(item, 'id');
	const name = readString(item, 'name');
	if (id == null || !name) return null;
	const category: KickCategory = { id, name };
	const thumbnail = readString(item, 'thumbnail');
	if (thumbnail) category.thumbnail = thumbnail;
	return category;
}

export function parseKickLivestream(item: unknown): KickLivestream | null {
	if (!isRecord(item)) return null;
	const broadcaster_user_id = readNumber(item, 'broadcaster_user_id');
	const channel_id = readNumber(item, 'channel_id');
	const slug = readString(item, 'slug');
	const stream_title = readString(item, 'stream_title');
	const started_at = readString(item, 'started_at');
	if (broadcaster_user_id == null || channel_id == null || !slug || !stream_title || !started_at) return null;
	const stream: KickLivestream = {
		broadcaster_user_id,
		channel_id,
		slug,
		stream_title,
		started_at,
	};
	const viewer_count = item.viewer_count;
	if (viewer_count === null || typeof viewer_count === 'number') stream.viewer_count = viewer_count;
	const language = readString(item, 'language');
	if (language) stream.language = language;
	const categoryRaw = item.category;
	if (categoryRaw === null) stream.category = null;
	else if (categoryRaw !== undefined) {
		const category = parseKickCategory(categoryRaw);
		if (category) stream.category = category;
	}
	return stream;
}

export function parseKickChannel(item: unknown): KickChannel | null {
	if (!isRecord(item)) return null;
	const broadcaster_user_id = readNumber(item, 'broadcaster_user_id');
	const channel_id = readNumber(item, 'channel_id');
	const slug = readString(item, 'slug');
	if (broadcaster_user_id == null || channel_id == null || !slug) return null;
	const channel: KickChannel = { broadcaster_user_id, channel_id, slug };
	const stream_title = readString(item, 'stream_title');
	if (stream_title) channel.stream_title = stream_title;
	const viewer_count = item.viewer_count;
	if (viewer_count === null || typeof viewer_count === 'number') channel.viewer_count = viewer_count;
	return channel;
}

export function parseKickCategoryWithTags(item: unknown): KickCategoryWithTags | null {
	if (!isRecord(item)) return null;
	const id = readNumber(item, 'id');
	const name = readString(item, 'name');
	if (id == null || !name) return null;
	const category: KickCategoryWithTags = { id, name };
	const tags = readStringArray(item, 'tags');
	if (tags) category.tags = tags;
	const thumbnail = readString(item, 'thumbnail');
	if (thumbnail) category.thumbnail = thumbnail;
	return category;
}

export function parseKickApiListResponse<T>(data: unknown, parseItem: (item: unknown) => T | null): { data: T[]; message?: string } {
	if (!isRecord(data)) throw new Error('Invalid Kick API list response');
	const rawData = readArray(data, 'data') ?? [];
	return {
		data: rawData.map(parseItem).filter((item): item is T => item !== null),
		message: readString(data, 'message'),
	};
}

export function parseKickPaginatedResponse<T>(
	data: unknown,
	parseItem: (item: unknown) => T | null,
): { data: T[]; message?: string; pagination?: { next_cursor?: string } } {
	if (!isRecord(data)) throw new Error('Invalid Kick paginated response');
	const list = parseKickApiListResponse(data, parseItem);
	const paginationRaw = data.pagination;
	let pagination: { next_cursor?: string } | undefined;
	if (isRecord(paginationRaw)) {
		const next_cursor = readString(paginationRaw, 'next_cursor');
		pagination = next_cursor ? { next_cursor } : {};
	}
	return { ...list, pagination };
}

function parseYoutubeVideoItem(item: unknown): YoutubeVideoItem | null {
	if (!isRecord(item)) return null;
	const id = readString(item, 'id');
	const snippetRaw = item.snippet;
	if (!id || !isRecord(snippetRaw)) return null;
	const channelId = readString(snippetRaw, 'channelId');
	const title = readString(snippetRaw, 'title');
	if (!channelId || !title) return null;
	const video: YoutubeVideoItem = {
		id,
		snippet: {
			channelId,
			title,
			liveBroadcastContent: readString(snippetRaw, 'liveBroadcastContent'),
			categoryId: readString(snippetRaw, 'categoryId'),
		},
	};
	const liveRaw = item.liveStreamingDetails;
	if (isRecord(liveRaw)) {
		video.liveStreamingDetails = {
			actualStartTime: readString(liveRaw, 'actualStartTime'),
			actualEndTime: readString(liveRaw, 'actualEndTime'),
			concurrentViewers: readStringOrNumber(liveRaw, 'concurrentViewers'),
		};
	}
	return video;
}

function parseYoutubeChannelItem(item: unknown): YoutubeChannelItem | null {
	if (!isRecord(item)) return null;
	const id = readString(item, 'id');
	if (!id) return null;
	const channel: YoutubeChannelItem = { id };
	const snippetRaw = item.snippet;
	if (isRecord(snippetRaw)) {
		channel.snippet = {
			title: readString(snippetRaw, 'title'),
			customUrl: readString(snippetRaw, 'customUrl'),
		};
	}
	const contentDetailsRaw = item.contentDetails;
	if (isRecord(contentDetailsRaw)) {
		const relatedPlaylistsRaw = contentDetailsRaw.relatedPlaylists;
		if (isRecord(relatedPlaylistsRaw)) {
			const uploads = readString(relatedPlaylistsRaw, 'uploads');
			channel.contentDetails = { relatedPlaylists: uploads ? { uploads } : undefined };
		}
	}
	return channel;
}

function parseYoutubePlaylistItem(item: unknown): YoutubePlaylistItem | null {
	if (!isRecord(item)) return null;
	const playlistItem: YoutubePlaylistItem = {};
	const snippetRaw = item.snippet;
	if (isRecord(snippetRaw)) {
		const resourceIdRaw = snippetRaw.resourceId;
		playlistItem.snippet = {
			liveBroadcastContent: readString(snippetRaw, 'liveBroadcastContent'),
			resourceId: isRecord(resourceIdRaw) ? { videoId: readString(resourceIdRaw, 'videoId') } : undefined,
		};
	}
	return playlistItem;
}

export function parseYoutubeVideoListResponse(data: unknown): YoutubeVideoListResponse {
	if (!isRecord(data)) throw new Error('Invalid YouTube videos response');
	const rawItems = readArray(data, 'items') ?? [];
	return {
		items: rawItems.map(parseYoutubeVideoItem).filter((item): item is YoutubeVideoItem => item !== null),
	};
}

export function parseYoutubeChannelListResponse(data: unknown): YoutubeChannelListResponse {
	if (!isRecord(data)) throw new Error('Invalid YouTube channels response');
	const rawItems = readArray(data, 'items') ?? [];
	return {
		items: rawItems.map(parseYoutubeChannelItem).filter((item): item is YoutubeChannelItem => item !== null),
	};
}

export function parseYoutubePlaylistItemsResponse(data: unknown): YoutubePlaylistItemsResponse {
	if (!isRecord(data)) throw new Error('Invalid YouTube playlistItems response');
	const rawItems = readArray(data, 'items') ?? [];
	return {
		items: rawItems.map(parseYoutubePlaylistItem).filter((item): item is YoutubePlaylistItem => item !== null),
	};
}

export function parseMetadataAtJson(value: string): string {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed)) return value;
		return readString(parsed, 'at') ?? value;
	} catch {
		return value;
	}
}

export type DedupEntry = { seenAt: string };

export function parseDedupEntry(value: string): DedupEntry | null {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed)) return null;
		const seenAt = readString(parsed, 'seenAt');
		if (!seenAt) return null;
		return { seenAt };
	} catch {
		return null;
	}
}

export function parseAdminQuickBody(data: unknown): { quick: boolean } {
	if (!isRecord(data)) return { quick: false };
	return { quick: data.quick === true };
}

export function parseAdminSeedBody(data: unknown): { seed: string[] } {
	if (!isRecord(data)) return { seed: [] };
	const seed = data.seed;
	if (!Array.isArray(seed)) return { seed: [] };
	return { seed: seed.filter((item): item is string => typeof item === 'string') };
}

export function parseAdminDateBody(data: unknown): { date?: string } {
	if (!isRecord(data)) return {};
	const date = readString(data, 'date');
	return date ? { date } : {};
}

export function parseAdminCsvBody(data: unknown): { csv?: string } {
	if (!isRecord(data)) return {};
	const csv = readString(data, 'csv');
	return csv ? { csv } : {};
}

export function parseVodBackfillBody(data: unknown): { platform_channel_ids?: string[]; limit?: number } {
	if (!isRecord(data)) return {};
	const out: { platform_channel_ids?: string[]; limit?: number } = {};
	const ids = data.platform_channel_ids;
	if (Array.isArray(ids)) {
		out.platform_channel_ids = ids.filter((id): id is string => typeof id === 'string');
	}
	const limit = readNumber(data, 'limit');
	if (limit != null && limit > 0) out.limit = Math.floor(limit);
	return out;
}

export function readMetadataValue(row: unknown): string | undefined {
	if (!isRecord(row)) return undefined;
	return readString(row, 'value');
}

export const INGEST_STATE_KEYS = ['discovered', 'tracked', 'dormant', 'retired'] as const;

export type IngestStateKey = (typeof INGEST_STATE_KEYS)[number];

export function isIngestStateKey(key: string): key is IngestStateKey {
	return key === 'discovered' || key === 'tracked' || key === 'dormant' || key === 'retired';
}

export function parseIngestStateRow(row: unknown): { ingest_state: string; n: number } | null {
	if (!isRecord(row)) return null;
	const ingest_state = readString(row, 'ingest_state');
	const n = readNumber(row, 'n');
	if (!ingest_state || n == null) return null;
	return { ingest_state, n };
}
