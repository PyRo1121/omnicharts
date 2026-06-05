import type { IngestPlatform } from './ingest-budget';
import type { IngestQueueMessage } from './messages';

/** Minimum full-coverage fan-out (sweep+game pass shared dedup + reconcile). */
export const TWITCH_COVERAGE_FANOUT_MESSAGES: IngestQueueMessage[] = [{ type: 'poll_twitch_sweep' }, { type: 'poll_twitch_reconcile' }];

/**
 * Per-platform queue fan-out — Kick/YouTube avoid Twitch global sweep duplication.
 * Phase 3 handlers consume `poll_kick_tracked` / `poll_youtube_tracked` only.
 */
export function coverageMessagesForPlatform(platform: IngestPlatform): IngestQueueMessage[] {
	switch (platform) {
		case 'twitch':
			return [...TWITCH_COVERAGE_FANOUT_MESSAGES];
		case 'kick':
			return [{ type: 'poll_kick_tracked' }];
		case 'youtube':
			return [{ type: 'poll_youtube_tracked' }];
		default: {
			const exhaustiveCheck: never = platform;
			return exhaustiveCheck;
		}
	}
}
