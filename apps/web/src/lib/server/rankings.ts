import { parseRankingPeriod, type PlatformId } from '@omnicharts/domain';
import {
	buildRankingsChannelsResponse,
	formatHoursWatched,
	type RankingsChannelsResponse
} from '@omnicharts/rollup';
import { getIngestBaseUrl } from '$lib/server/ingest';
import type { ServerLoadContext } from '$lib/server/load-context';
import { webRankingEligibility } from '$lib/server/ranking-env';
import { topChannels, type ChannelRow, type Period } from '$lib/mock/home';

function periodForApi(period: Period): string {
	if (period === '24h' || period === '7d' || period === '30d' || period === '90d') return period;
	return '7d';
}

export type RankingsSource = 'live' | 'mock' | 'unavailable';

export type ChannelRankingsLoad = {
	source: RankingsSource;
	period: Period;
	updatedAt: string | null;
	rows: ChannelRow[];
};

function mapChannelRankingsBody(
	body: RankingsChannelsResponse,
	period: Period,
	limit: number,
	platform: PlatformId
): ChannelRankingsLoad {
	if (!body.items?.length) {
		return { source: 'live', period, updatedAt: body.updated_at, rows: [] };
	}
	return {
		source: 'live',
		period,
		updatedAt: body.updated_at,
		rows: body.items.slice(0, limit).map((item) => ({
			rank: item.rank,
			slug: item.slug,
			displayName: item.display_name,
			platform,
			avatarUrl: item.avatar_url ?? '',
			metric: formatHoursWatched(item.hours_watched),
			metricLabel: 'Hours watched'
		}))
	};
}

const ROLLUP_CHANNEL_PLATFORMS = new Set<PlatformId>(['twitch', 'kick', 'youtube']);

function supportsRollupChannelRankings(platform: PlatformId): boolean {
	return ROLLUP_CHANNEL_PLATFORMS.has(platform);
}

async function loadFromD1(
	db: D1Database,
	platform: PlatformId,
	period: Period,
	limit: number,
	cfEnv: ServerLoadContext['cfEnv']
): Promise<ChannelRankingsLoad> {
	const apiPeriod = parseRankingPeriod(periodForApi(period));
	const eligibility = webRankingEligibility(cfEnv, platform);
	const body = await buildRankingsChannelsResponse(db, {
		platform,
		period: apiPeriod,
		limit,
		minAirtimeMinutes: eligibility.minAirtimeMinutes,
		minAverageViewers: eligibility.minAverageViewers
	});
	return mapChannelRankingsBody(body, period, limit, platform);
}

async function loadFromIngest(
	fetchFn: typeof fetch,
	platform: PlatformId,
	period: Period,
	limit: number
): Promise<ChannelRankingsLoad | null> {
	const apiPeriod = periodForApi(period);
	const url = `${getIngestBaseUrl()}/v1/rankings/channels?platform=${encodeURIComponent(platform)}&period=${apiPeriod}&limit=${limit}`;
	const res = await fetchFn(url, { headers: { accept: 'application/json' } });
	if (!res.ok) return null;
	const body = (await res.json()) as RankingsChannelsResponse;
	return mapChannelRankingsBody(body, period, limit, platform);
}

export async function loadChannelRankings(
	ctx: ServerLoadContext,
	platform: PlatformId,
	period: Period,
	limit = 20,
	mockEnabled = false
): Promise<ChannelRankingsLoad> {
	if (!supportsRollupChannelRankings(platform)) {
		return { source: 'live', period, updatedAt: null, rows: [] };
	}

	if (ctx.db) {
		try {
			const load = await loadFromD1(ctx.db, platform, period, limit, ctx.cfEnv);
			if (mockEnabled && load.rows.length === 0) {
				return { source: 'mock', period, updatedAt: null, rows: topChannels.slice(0, limit) };
			}
			return load;
		} catch {
			if (mockEnabled) {
				return { source: 'mock', period, updatedAt: null, rows: topChannels.slice(0, limit) };
			}
			return { source: 'unavailable', period, updatedAt: null, rows: [] };
		}
	}

	try {
		const live = await loadFromIngest(ctx.fetch, platform, period, limit);
		if (live) return live;
		throw new Error('rankings unavailable');
	} catch {
		if (mockEnabled) {
			return { source: 'mock', period, updatedAt: null, rows: topChannels.slice(0, limit) };
		}
		return { source: 'unavailable', period, updatedAt: null, rows: [] };
	}
}

/** @deprecated Prefer {@link loadChannelRankings} with explicit `platform`. */
export async function loadTwitchChannelRankings(
	ctx: ServerLoadContext,
	period: Period,
	limit = 20,
	mockEnabled = false
): Promise<ChannelRankingsLoad> {
	return loadChannelRankings(ctx, 'twitch', period, limit, mockEnabled);
}
