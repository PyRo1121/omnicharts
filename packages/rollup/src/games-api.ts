import type { D1Database } from './d1';
import {
	isPlatformId,
	isRankingPeriod,
	parseRankingPeriod,
	periodToDays,
	PLATFORM_TWITCH,
	type RankingPeriod
} from '@omnicharts/domain';
import { MIN_RANKING_AIRTIME_MINUTES } from './eligibility';
import { rankingQueryOptionsFromEnv, type RankingEligibilityEnv } from './ranking-env';
import { getTopGamesByAverageViewers } from './top-games';
import type { RankingsQueryError } from './channels-api';

export type RankingsGamesItem = {
	rank: number;
	slug: string;
	name: string;
	average_viewers: number;
	hours_watched: number;
	box_art_url: string | null;
};

export type RankingsGamesResponse = {
	platform: string;
	period: RankingPeriod;
	updated_at: string;
	items: RankingsGamesItem[];
};

export type ParsedRankingsGamesQuery =
	| { ok: true; platform: string; period: RankingPeriod; limit: number }
	| { ok: false; error: RankingsQueryError };

export function parseRankingsGamesQuery(url: URL): ParsedRankingsGamesQuery {
	const platformRaw = url.searchParams.get('platform') ?? PLATFORM_TWITCH;
	if (!isPlatformId(platformRaw)) {
		return { ok: false, error: 'invalid_platform' };
	}
	const platform = platformRaw;
	const periodRaw = url.searchParams.get('period');
	if (periodRaw != null && periodRaw !== '' && !isRankingPeriod(periodRaw)) {
		return { ok: false, error: 'invalid_period' };
	}
	const period = parseRankingPeriod(periodRaw);
	const limitRaw = url.searchParams.get('limit') ?? '20';
	const limitNum = Number(limitRaw);
	if (Number.isNaN(limitNum) || limitNum < 1) {
		return { ok: false, error: 'invalid_limit' };
	}
	const limit = Math.min(100, Math.max(1, Math.floor(limitNum)));
	return { ok: true, platform, period, limit };
}

export async function buildRankingsGamesResponse(
	db: D1Database,
	opts: { platform: string; period: RankingPeriod; limit: number },
	env?: RankingEligibilityEnv
): Promise<RankingsGamesResponse> {
	const days = periodToDays(opts.period);
	const eligibility = env
		? rankingQueryOptionsFromEnv(env)
		: { minAirtimeMinutes: MIN_RANKING_AIRTIME_MINUTES, minAverageViewers: 0 };
	const rankings = await getTopGamesByAverageViewers(db, {
		platformId: opts.platform,
		days,
		limit: opts.limit,
		minAirtimeMinutes: eligibility.minAirtimeMinutes,
		minAverageViewers: eligibility.minAverageViewers
	});

	return {
		platform: opts.platform,
		period: opts.period,
		updated_at: new Date().toISOString(),
		items: rankings.map((r) => ({
			rank: r.rank,
			slug: r.slug,
			name: r.name,
			average_viewers: Math.round(r.averageViewers),
			hours_watched: Math.round(r.hoursWatched),
			box_art_url: null
		}))
	};
}
