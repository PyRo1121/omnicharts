import { isRankingPeriod, type PlatformId } from '@omnicharts/domain';
import type { ChannelDetailResponse, GameDetailResponse, RankingsChannelsResponse, RankingsGamesResponse } from '@omnicharts/rollup';
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
	const value = record[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
	const value = record[key];
	return Array.isArray(value) ? value : undefined;
}

export function parseRankingsChannelsResponse(data: unknown): RankingsChannelsResponse | null {
	if (!isRecord(data)) return null;
	const platform = readString(data, 'platform');
	const period = readString(data, 'period');
	const updated_at = readString(data, 'updated_at');
	const itemsRaw = readArray(data, 'items');
	if (!platform || !period || !updated_at || !itemsRaw || !isRankingPeriod(period)) return null;
	return {
		platform,
		period,
		updated_at,
		items: itemsRaw.map((item) => {
			if (!isRecord(item)) return null;
			const slug = readString(item, 'slug');
			const display_name = readString(item, 'display_name');
			const hours_watched = readNumber(item, 'hours_watched');
			const average_viewers = readNumber(item, 'average_viewers');
			const stream_count = readNumber(item, 'stream_count');
			if (!slug || !display_name || hours_watched == null || average_viewers == null || stream_count == null) return null;
			return {
				rank: readNumber(item, 'rank') ?? 0,
				slug,
				display_name,
				avatar_url: typeof item.avatar_url === 'string' || item.avatar_url === null ? item.avatar_url : null,
				hours_watched,
				average_viewers,
				peak_viewers: readNumber(item, 'peak_viewers'),
				airtime_hours: readNumber(item, 'airtime_hours'),
				stream_count,
				tracked_since: typeof item.tracked_since === 'string' || item.tracked_since === null ? item.tracked_since : null,
			};
		}).filter((item): item is NonNullable<typeof item> => item !== null),
	};
}

export function parseRankingsGamesResponse(data: unknown): RankingsGamesResponse | null {
	if (!isRecord(data)) return null;
	const platform = readString(data, 'platform');
	const period = readString(data, 'period');
	const updated_at = readString(data, 'updated_at');
	const itemsRaw = readArray(data, 'items');
	if (!platform || !period || !updated_at || !itemsRaw || !isRankingPeriod(period)) return null;
	return {
		platform,
		period,
		updated_at,
		items: itemsRaw
			.map((item) => {
				if (!isRecord(item)) return null;
				const slug = readString(item, 'slug');
				const name = readString(item, 'name');
				const hours_watched = readNumber(item, 'hours_watched');
				const average_viewers = readNumber(item, 'average_viewers');
				if (!slug || !name || hours_watched == null || average_viewers == null) return null;
				return {
					rank: readNumber(item, 'rank') ?? 0,
					slug,
					name,
					hours_watched,
					average_viewers,
					peak_viewers: readNumber(item, 'peak_viewers'),
					airtime_hours: readNumber(item, 'airtime_hours'),
					live_channels: readNumber(item, 'live_channels'),
				};
			})
			.filter((item): item is NonNullable<typeof item> => item !== null),
	};
}

export type IngestHealthJson = {
	status: string;
	tracked_channels: { twitch: number; kick: number; youtube: number };
	channels_live: number;
	channels_live_by_platform?: { twitch: number; kick: number; youtube: number };
	discovery_new_24h: number;
};

export function parseIngestHealth(data: unknown): IngestHealthJson | null {
	if (!isRecord(data)) return null;
	const status = readString(data, 'status');
	const channels_live = readNumber(data, 'channels_live');
	const discovery_new_24h = readNumber(data, 'discovery_new_24h');
	const trackedRaw = data.tracked_channels;
	if (!status || channels_live == null || discovery_new_24h == null || !isRecord(trackedRaw)) return null;
	const twitch = readNumber(trackedRaw, 'twitch');
	const kick = readNumber(trackedRaw, 'kick');
	const youtube = readNumber(trackedRaw, 'youtube');
	if (twitch == null || kick == null || youtube == null) return null;
	const health: IngestHealthJson = {
		status,
		channels_live,
		discovery_new_24h,
		tracked_channels: { twitch, kick, youtube },
	};
	const byPlatformRaw = data.channels_live_by_platform;
	if (isRecord(byPlatformRaw)) {
		const pt = readNumber(byPlatformRaw, 'twitch');
		const pk = readNumber(byPlatformRaw, 'kick');
		const py = readNumber(byPlatformRaw, 'youtube');
		if (pt != null && pk != null && py != null) {
			health.channels_live_by_platform = { twitch: pt, kick: pk, youtube: py };
		}
	}
	return health;
}

export function parseChannelLookupBody(data: unknown): { slug: string; display_name: string; platform?: string } | null {
	if (!isRecord(data)) return null;
	const slug = readString(data, 'slug');
	const display_name = readString(data, 'display_name');
	if (!slug || !display_name) return null;
	const platform = readString(data, 'platform');
	return platform ? { slug, display_name, platform } : { slug, display_name };
}

export function parseChannelResolveBody(data: unknown): { slug: string; from_history?: boolean } | null {
	if (!isRecord(data)) return null;
	const slug = readString(data, 'slug');
	if (!slug) return null;
	const from_history = data.from_history === true ? true : undefined;
	return from_history ? { slug, from_history } : { slug };
}

export function parseIngestChannelResponse(data: unknown): ChannelDetailResponse | null {
	if (!isRecord(data)) return null;
	const platform = readString(data, 'platform');
	const slug = readString(data, 'slug');
	const display_name = readString(data, 'display_name');
	const period = readString(data, 'period');
	const ingest_state = readString(data, 'ingest_state');
	const totalsRaw = data.totals;
	if (!platform || !slug || !display_name || !period || !ingest_state || !isRecord(totalsRaw) || !isRankingPeriod(period)) {
		return null;
	}
	const hours_watched = readNumber(totalsRaw, 'hours_watched');
	const average_viewers = readNumber(totalsRaw, 'average_viewers');
	const peak_viewers = readNumber(totalsRaw, 'peak_viewers');
	const airtime_hours = readNumber(totalsRaw, 'airtime_hours');
	const stream_count = readNumber(totalsRaw, 'stream_count');
	if (
		hours_watched == null ||
		average_viewers == null ||
		peak_viewers == null ||
		airtime_hours == null ||
		stream_count == null
	) {
		return null;
	}
	return {
		platform,
		slug,
		display_name,
		avatar_url: typeof data.avatar_url === 'string' || data.avatar_url === null ? data.avatar_url : null,
		language: typeof data.language === 'string' || data.language === null ? data.language : null,
		tracked_since: typeof data.tracked_since === 'string' || data.tracked_since === null ? data.tracked_since : null,
		ingest_state,
		follower_count: typeof data.follower_count === 'number' || data.follower_count === null ? data.follower_count : null,
		description: typeof data.description === 'string' || data.description === null ? data.description : null,
		period,
		totals: {
			hours_watched,
			average_viewers,
			peak_viewers,
			airtime_hours,
			stream_count,
			followers_gain:
				typeof totalsRaw.followers_gain === 'number' || totalsRaw.followers_gain === null ? totalsRaw.followers_gain : null,
		},
		daily: [],
	};
}

export function parseIngestGameResponse(data: unknown): GameDetailResponse | null {
	if (!isRecord(data)) return null;
	const platform = readString(data, 'platform');
	const slug = readString(data, 'slug');
	const name = readString(data, 'name');
	const period = readString(data, 'period');
	const totalsRaw = data.totals;
	if (!platform || !slug || !name || !period || !isRecord(totalsRaw) || !isRankingPeriod(period)) return null;
	const hours_watched = readNumber(totalsRaw, 'hours_watched');
	const average_viewers = readNumber(totalsRaw, 'average_viewers');
	const peak_viewers = readNumber(totalsRaw, 'peak_viewers');
	const airtime_hours = readNumber(totalsRaw, 'airtime_hours');
	const live_channels = readNumber(totalsRaw, 'live_channels');
	if (hours_watched == null || average_viewers == null || peak_viewers == null || airtime_hours == null || live_channels == null) {
		return null;
	}
	return {
		platform,
		slug,
		name,
		period,
		totals: { hours_watched, average_viewers, peak_viewers, airtime_hours, live_channels },
		daily: [],
		top_channels: [],
	};
}

export function parseIngestSearchResponse(data: unknown): {
	results: { id: string; slug: string; display_name: string; avatar_url: string | null; platform_id: string }[];
} | null {
	if (!isRecord(data)) return null;
	const resultsRaw = readArray(data, 'results');
	if (!resultsRaw) return null;
	const results = resultsRaw
		.map((item) => {
			if (!isRecord(item)) return null;
			const id = readString(item, 'id');
			const slug = readString(item, 'slug');
			const display_name = readString(item, 'display_name');
			const platform_id = readString(item, 'platform_id');
			if (!id || !slug || !display_name || !platform_id) return null;
			return {
				id,
				slug,
				display_name,
				avatar_url: typeof item.avatar_url === 'string' || item.avatar_url === null ? item.avatar_url : null,
				platform_id,
			};
		})
		.filter((item): item is NonNullable<typeof item> => item !== null);
	return { results };
}

export function isPlatformId(value: string): value is PlatformId {
	return value === 'twitch' || value === 'kick' || value === 'youtube';
}
