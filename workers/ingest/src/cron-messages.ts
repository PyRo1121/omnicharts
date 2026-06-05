import {
	MULTI_PLATFORM_CRON,
	TWITCH_CRON,
	TWITCH_STAGING_CRON,
	multiPlatformCronMessages,
	twitchCronEnqueueMessages
} from './ingest-budget';
import type { IngestQueueMessage } from './messages';

export { MULTI_PLATFORM_CRON, TWITCH_CRON, TWITCH_STAGING_CRON };

export const ROLLUP_CRON = '15 0 * * *';
export const DISCOVER_TWITCH_CRON = '0 */6 * * *';

export function cronToMessages(cron: string, env?: Env): IngestQueueMessage[] {
	switch (cron) {
		case TWITCH_CRON:
		case TWITCH_STAGING_CRON:
			return env
				? twitchCronEnqueueMessages(env)
				: [{ type: 'poll_platform', platform: 'twitch' }];
		case MULTI_PLATFORM_CRON:
			return multiPlatformCronMessages();
		case ROLLUP_CRON:
			return [{ type: 'rollup_daily' }];
		case DISCOVER_TWITCH_CRON:
			return [{ type: 'discover_twitch' }, { type: 'sync_eventsub_twitch' }];
		default:
			return [];
	}
}
