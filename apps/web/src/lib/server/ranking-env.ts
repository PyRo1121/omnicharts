import { env } from '$env/dynamic/private';
import { rankingQueryOptionsFromEnv } from '@omnicharts/rollup';

/** Subset of Pages `platform.env` / wrangler vars — parity with ingest production (doc 11, 23). */
export type WebRankingEnv = Pick<
	Env,
	'TWITCH_MIN_VIEWERS' | 'TWITCH_RANKING_MIN_AIRTIME_MINUTES'
>;

/** Resolved TWITCH_* vars — `platform.env` on Pages, else `$env/dynamic/private` (vite dev). */
export function resolveWebRankingEnv(cfEnv?: WebRankingEnv | null): WebRankingEnv {
	return (
		cfEnv ?? {
			TWITCH_RANKING_MIN_AIRTIME_MINUTES: env.TWITCH_RANKING_MIN_AIRTIME_MINUTES,
			TWITCH_MIN_VIEWERS: env.TWITCH_MIN_VIEWERS
		}
	);
}

/** Parity with ingest Worker eligibility vars (TWITCH_*). Prefer `platform.env` on Pages. */
export function webRankingEligibility(
	cfEnv?: WebRankingEnv | null
): { minAirtimeMinutes: number; minAverageViewers: number } {
	return rankingQueryOptionsFromEnv(resolveWebRankingEnv(cfEnv));
}
