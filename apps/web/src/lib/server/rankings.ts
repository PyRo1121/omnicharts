import { parseRankingPeriod } from '@omnicharts/domain';
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
	limit: number
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
			platform: 'twitch',
			avatarUrl: item.avatar_url ?? '',
			metric: formatHoursWatched(item.hours_watched),
			metricLabel: 'Hours watched'
		}))
	};
}

async function loadFromD1(
	db: D1Database,
	period: Period,
	limit: number,
	cfEnv: ServerLoadContext['cfEnv']
): Promise<ChannelRankingsLoad> {
	const apiPeriod = parseRankingPeriod(periodForApi(period));
	const eligibility = webRankingEligibility(cfEnv);
	const body = await buildRankingsChannelsResponse(db, {
		platform: 'twitch',
		period: apiPeriod,
		limit,
		minAirtimeMinutes: eligibility.minAirtimeMinutes,
		minAverageViewers: eligibility.minAverageViewers
	});
	return mapChannelRankingsBody(body, period, limit);
}

async function loadFromIngest(
	fetchFn: typeof fetch,
	period: Period,
	limit: number
): Promise<ChannelRankingsLoad | null> {
	const apiPeriod = periodForApi(period);
	const url = `${getIngestBaseUrl()}/v1/rankings/channels?platform=twitch&period=${apiPeriod}&limit=${limit}`;
	const res = await fetchFn(url, { headers: { accept: 'application/json' } });
	if (!res.ok) return null;
	const body = (await res.json()) as RankingsChannelsResponse;
	return mapChannelRankingsBody(body, period, limit);
}

export async function loadTwitchChannelRankings(
	ctx: ServerLoadContext,
	period: Period,
	limit = 20,
	mockEnabled = false
): Promise<ChannelRankingsLoad> {
	if (ctx.db) {
		try {
			return await loadFromD1(ctx.db, period, limit, ctx.cfEnv);
		} catch {
			if (mockEnabled) {
				return { source: 'mock', period, updatedAt: null, rows: topChannels.slice(0, limit) };
			}
			return { source: 'unavailable', period, updatedAt: null, rows: [] };
		}
	}

	try {
		const live = await loadFromIngest(ctx.fetch, period, limit);
		if (live) return live;
		throw new Error('rankings unavailable');
	} catch {
		if (mockEnabled) {
			return { source: 'mock', period, updatedAt: null, rows: topChannels.slice(0, limit) };
		}
		return { source: 'unavailable', period, updatedAt: null, rows: [] };
	}
}
