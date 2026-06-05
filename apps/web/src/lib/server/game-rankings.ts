import { parseRankingPeriod } from '@omnicharts/domain';
import {
	buildRankingsGamesResponse,
	formatCompactMetric,
	type RankingsGamesResponse
} from '@omnicharts/rollup';
import { getIngestBaseUrl } from '$lib/server/ingest';
import type { ServerLoadContext } from '$lib/server/load-context';
import { resolveWebRankingEnv } from '$lib/server/ranking-env';
import { topGames, type GameRow, type Period } from '$lib/mock/home';

function periodForApi(period: Period): string {
	if (period === '24h' || period === '7d' || period === '30d' || period === '90d') return period;
	return '7d';
}

export type RankingsSource = 'live' | 'mock' | 'unavailable';

export type GameRankingsLoad = {
	source: RankingsSource;
	period: Period;
	updatedAt: string | null;
	rows: GameRow[];
};

function mapGameRankingsBody(
	body: RankingsGamesResponse,
	period: Period,
	limit: number
): GameRankingsLoad {
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
			name: item.name,
			platform: 'twitch',
			boxArtUrl: item.box_art_url ?? '',
			metric: formatCompactMetric(item.average_viewers),
			metricLabel: 'Avg viewers'
		}))
	};
}

async function loadFromD1(
	db: D1Database,
	period: Period,
	limit: number,
	cfEnv: ServerLoadContext['cfEnv']
): Promise<GameRankingsLoad> {
	const apiPeriod = parseRankingPeriod(periodForApi(period));
	const body = await buildRankingsGamesResponse(
		db,
		{ platform: 'twitch', period: apiPeriod, limit },
		resolveWebRankingEnv(cfEnv)
	);
	return mapGameRankingsBody(body, period, limit);
}

async function loadFromIngest(
	fetchFn: typeof fetch,
	period: Period,
	limit: number
): Promise<GameRankingsLoad | null> {
	const apiPeriod = periodForApi(period);
	const url = `${getIngestBaseUrl()}/v1/rankings/games?platform=twitch&period=${apiPeriod}&limit=${limit}`;
	const res = await fetchFn(url, { headers: { accept: 'application/json' } });
	if (!res.ok) return null;
	const body = (await res.json()) as RankingsGamesResponse;
	return mapGameRankingsBody(body, period, limit);
}

export async function loadTwitchGameRankings(
	ctx: ServerLoadContext,
	period: Period,
	limit = 20,
	mockEnabled = false
): Promise<GameRankingsLoad> {
	if (ctx.db) {
		try {
			return await loadFromD1(ctx.db, period, limit, ctx.cfEnv);
		} catch {
			if (mockEnabled) {
				return { source: 'mock', period, updatedAt: null, rows: topGames.slice(0, limit) };
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
			return { source: 'mock', period, updatedAt: null, rows: topGames.slice(0, limit) };
		}
		return { source: 'unavailable', period, updatedAt: null, rows: [] };
	}
}
