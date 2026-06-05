import { env } from '$env/dynamic/private';
import { rankingQueryOptionsForPlatform, type RankingEligibilityEnv } from '@omnicharts/rollup';

export type WebRankingEnv = RankingEligibilityEnv;

/** Resolved ranking vars — `platform.env` on Pages, else `$env/dynamic/private` (vite dev). */
function readEnvString(key: keyof RankingEligibilityEnv): string | undefined {
	const value = env[key];
	return typeof value === 'string' ? value : undefined;
}

export function resolveWebRankingEnv(cfEnv?: RankingEligibilityEnv | null): RankingEligibilityEnv {
	return (
		cfEnv ?? {
			TWITCH_RANKING_MIN_AIRTIME_MINUTES: readEnvString('TWITCH_RANKING_MIN_AIRTIME_MINUTES'),
			TWITCH_MIN_VIEWERS: readEnvString('TWITCH_MIN_VIEWERS'),
			KICK_MIN_VIEWERS: readEnvString('KICK_MIN_VIEWERS'),
			YOUTUBE_MIN_VIEWERS: readEnvString('YOUTUBE_MIN_VIEWERS'),
		}
	);
}

/** Parity with ingest Worker eligibility vars per platform. Prefer `platform.env` on Pages. */
export function webRankingEligibility(
	cfEnv?: RankingEligibilityEnv | null,
	platformId = 'twitch',
): { minAirtimeMinutes: number; minAverageViewers: number } {
	return rankingQueryOptionsForPlatform(resolveWebRankingEnv(cfEnv), platformId);
}
