import { env } from '$env/dynamic/private';
import { rankingQueryOptionsForPlatform } from '@omnicharts/rollup';

/** Subset of Pages `platform.env` / wrangler vars — parity with ingest production (doc 11, 23). */
export type WebRankingEnv = Pick<
	Env,
	| 'TWITCH_MIN_VIEWERS'
	| 'TWITCH_RANKING_MIN_AIRTIME_MINUTES'
	| 'KICK_MIN_VIEWERS'
	| 'YOUTUBE_MIN_VIEWERS'
>;

/** Resolved ranking vars — `platform.env` on Pages, else `$env/dynamic/private` (vite dev). */
export function resolveWebRankingEnv(cfEnv?: WebRankingEnv | null): WebRankingEnv {
	return (
		cfEnv ?? {
			TWITCH_RANKING_MIN_AIRTIME_MINUTES: env.TWITCH_RANKING_MIN_AIRTIME_MINUTES,
			TWITCH_MIN_VIEWERS: env.TWITCH_MIN_VIEWERS,
			KICK_MIN_VIEWERS: env.KICK_MIN_VIEWERS,
			YOUTUBE_MIN_VIEWERS: env.YOUTUBE_MIN_VIEWERS
		}
	);
}

/** Parity with ingest Worker eligibility vars per platform. Prefer `platform.env` on Pages. */
export function webRankingEligibility(
	cfEnv?: WebRankingEnv | null,
	platformId = 'twitch'
): { minAirtimeMinutes: number; minAverageViewers: number } {
	return rankingQueryOptionsForPlatform(resolveWebRankingEnv(cfEnv), platformId);
}
