import { PLATFORM_KICK, PLATFORM_TWITCH, PLATFORM_YOUTUBE } from '@omnicharts/domain';
import { MIN_RANKING_AIRTIME_MINUTES } from './eligibility';

/** Wrangler / Pages env vars for public ranking eligibility (doc 11, 23). */
export type RankingEligibilityEnv = {
	TWITCH_MIN_VIEWERS?: string | number;
	TWITCH_RANKING_MIN_AIRTIME_MINUTES?: string | number;
	KICK_MIN_VIEWERS?: string | number;
	YOUTUBE_MIN_VIEWERS?: string | number;
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
	return rankingQueryOptionsForPlatform(env, PLATFORM_TWITCH);
}

export function minViewersForPlatformFromRankingEnv(
	env: RankingEligibilityEnv,
	platformId: string
): number {
	if (platformId === PLATFORM_KICK) {
		const n = Number(env.KICK_MIN_VIEWERS ?? env.TWITCH_MIN_VIEWERS ?? DEFAULT_MIN_VIEWERS);
		return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_VIEWERS;
	}
	if (platformId === PLATFORM_YOUTUBE) {
		const n = Number(env.YOUTUBE_MIN_VIEWERS ?? env.TWITCH_MIN_VIEWERS ?? DEFAULT_MIN_VIEWERS);
		return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_VIEWERS;
	}
	return minViewersFromRankingEnv(env);
}

export function rankingQueryOptionsForPlatform(
	env: RankingEligibilityEnv,
	platformId: string
): {
	minAirtimeMinutes: number;
	minAverageViewers: number;
} {
	return {
		minAirtimeMinutes: rankingMinAirtimeMinutesFromRankingEnv(env),
		minAverageViewers: minViewersForPlatformFromRankingEnv(env, platformId)
	};
}
