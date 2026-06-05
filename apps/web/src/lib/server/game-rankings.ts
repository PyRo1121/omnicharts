import { parseRankingPeriod, type PlatformId } from '@omnicharts/domain';
import { buildRankingsGamesResponse, formatCompactMetric, type RankingsGamesResponse } from '@omnicharts/rollup';
import { getIngestBaseUrl } from '$lib/server/ingest';
import type { ServerLoadContext } from '$lib/server/load-context';
import { resolveWebRankingEnv } from '$lib/server/ranking-env';
import { topGames, type GameRow, type RankingPeriod } from '$lib/mock/home';
import { periodForApi } from '$lib/server/period-api';

export type RankingsSource = 'live' | 'mock' | 'unavailable';

export type GameRankingsLoad = {
	source: RankingsSource;
	period: RankingPeriod;
	updatedAt: string | null;
	rows: GameRow[];
};

function mapGameRankingsBody(body: RankingsGamesResponse, period: RankingPeriod, limit: number, platform: PlatformId): GameRankingsLoad {
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
			platform,
			boxArtUrl: item.box_art_url ?? '',
			metric: formatCompactMetric(item.average_viewers),
			metricLabel: 'Avg viewers',
		})),
	};
}

const ROLLUP_GAME_PLATFORMS = new Set<PlatformId>(['twitch', 'kick', 'youtube']);

function supportsRollupGameRankings(platform: PlatformId): boolean {
	return ROLLUP_GAME_PLATFORMS.has(platform);
}

async function loadFromD1(
	db: D1Database,
	platform: PlatformId,
	period: RankingPeriod,
	limit: number,
	cfEnv: ServerLoadContext['cfEnv'],
): Promise<GameRankingsLoad> {
	const apiPeriod = parseRankingPeriod(periodForApi(period));
	const body = await buildRankingsGamesResponse(db, { platform, period: apiPeriod, limit }, resolveWebRankingEnv(cfEnv));
	return mapGameRankingsBody(body, period, limit, platform);
}

async function loadFromIngest(
	fetchFn: typeof fetch,
	platform: PlatformId,
	period: RankingPeriod,
	limit: number,
): Promise<GameRankingsLoad | null> {
	const apiPeriod = periodForApi(period);
	const url = `${getIngestBaseUrl()}/v1/rankings/games?platform=${encodeURIComponent(platform)}&period=${apiPeriod}&limit=${limit}`;
	const res = await fetchFn(url, { headers: { accept: 'application/json' } });
	if (!res.ok) return null;
	const body = (await res.json()) as RankingsGamesResponse;
	return mapGameRankingsBody(body, period, limit, platform);
}

export async function loadGameRankings(
	ctx: ServerLoadContext,
	platform: PlatformId,
	period: RankingPeriod,
	limit = 20,
	mockEnabled = false,
): Promise<GameRankingsLoad> {
	if (!supportsRollupGameRankings(platform)) {
		return { source: 'live', period, updatedAt: null, rows: [] };
	}

	if (ctx.db) {
		try {
			const load = await loadFromD1(ctx.db, platform, period, limit, ctx.cfEnv);
			if (mockEnabled && load.rows.length === 0) {
				return { source: 'mock', period, updatedAt: null, rows: topGames.slice(0, limit) };
			}
			return load;
		} catch {
			if (mockEnabled) {
				return { source: 'mock', period, updatedAt: null, rows: topGames.slice(0, limit) };
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
			return { source: 'mock', period, updatedAt: null, rows: topGames.slice(0, limit) };
		}
		return { source: 'unavailable', period, updatedAt: null, rows: [] };
	}
}
