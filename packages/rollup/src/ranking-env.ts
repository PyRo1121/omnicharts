import { MIN_RANKING_AIRTIME_MINUTES } from './eligibility';

/** Wrangler / Pages env vars for public ranking eligibility (doc 11, 23). */
export type RankingEligibilityEnv = {
	TWITCH_MIN_VIEWERS?: string | number;
	TWITCH_RANKING_MIN_AIRTIME_MINUTES?: string | number;
};

const DEFAULT_MIN_VIEWERS = 2;

export function minViewersFromRankingEnv(env: RankingEligibilityEnv): number {
	const n = Number(env.TWITCH_MIN_VIEWERS ?? DEFAULT_MIN_VIEWERS);
	return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_VIEWERS;
}

export function rankingMinAirtimeMinutesFromRankingEnv(env: RankingEligibilityEnv): number {
	const n = Number(env.TWITCH_RANKING_MIN_AIRTIME_MINUTES ?? MIN_RANKING_AIRTIME_MINUTES);
	return Number.isFinite(n) && n >= 0 ? n : MIN_RANKING_AIRTIME_MINUTES;
}

export function rankingQueryOptionsFromEnv(env: RankingEligibilityEnv): {
	minAirtimeMinutes: number;
	minAverageViewers: number;
} {
	return {
		minAirtimeMinutes: rankingMinAirtimeMinutesFromRankingEnv(env),
		minAverageViewers: minViewersFromRankingEnv(env)
	};
}
