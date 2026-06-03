import type { IngestQueueMessage } from './messages';

/** Twitch poll — every minute. */
export const TWITCH_CRON = '*/1 * * * *';
export const ROLLUP_CRON = '15 0 * * *';
export const DISCOVER_TWITCH_CRON = '0 */6 * * *';

export function cronToMessages(cron: string): IngestQueueMessage[] {
	switch (cron) {
		case TWITCH_CRON:
			return [{ type: 'poll_platform', platform: 'twitch' }];
		case ROLLUP_CRON:
			return [{ type: 'rollup_daily' }];
		case DISCOVER_TWITCH_CRON:
			return [{ type: 'discover_twitch' }, { type: 'sync_eventsub_twitch' }];
		default:
			return [];
	}
}
