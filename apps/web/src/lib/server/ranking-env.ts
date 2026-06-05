import { env } from '$env/dynamic/private';
import {
	rankingQueryOptionsForPlatform,
	type RankingEligibilityEnv
} from '@omnicharts/rollup';

export type WebRankingEnv = RankingEligibilityEnv;

/** Resolved ranking vars — `platform.env` on Pages, else `$env/dynamic/private` (vite dev). */
export function resolveWebRankingEnv(cfEnv?: RankingEligibilityEnv | null): RankingEligibilityEnv {
	const privateEnv = env as Record<string, string | undefined>;
	return (
		cfEnv ?? {
			TWITCH_RANKING_MIN_AIRTIME_MINUTES: privateEnv.TWITCH_RANKING_MIN_AIRTIME_MINUTES,
			TWITCH_MIN_VIEWERS: privateEnv.TWITCH_MIN_VIEWERS,
			KICK_MIN_VIEWERS: privateEnv.KICK_MIN_VIEWERS,
			YOUTUBE_MIN_VIEWERS: privateEnv.YOUTUBE_MIN_VIEWERS
		}
	);
}

/** Parity with ingest Worker eligibility vars per platform. Prefer `platform.env` on Pages. */
export function webRankingEligibility(
	cfEnv?: RankingEligibilityEnv | null,
	platformId = 'twitch'
): { minAirtimeMinutes: number; minAverageViewers: number } {
	return rankingQueryOptionsForPlatform(resolveWebRankingEnv(cfEnv), platformId);
}
