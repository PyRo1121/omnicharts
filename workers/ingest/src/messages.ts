/** Queue payloads — docs/15-ingest-runbook.md */

export type IngestQueueMessage =
	| { type: 'poll_platform'; platform: 'twitch' | 'kick' | 'youtube' }
	| { type: 'poll_channel_batch'; platform: 'twitch' | 'kick' | 'youtube'; channel_ids: string[] }
	| { type: 'poll_twitch_catalog' }
	| { type: 'poll_twitch_sweep' }
	| { type: 'poll_twitch_game_pass' }
	| { type: 'poll_twitch_reconcile' }
	| { type: 'poll_kick_tracked' }
	| { type: 'poll_youtube_tracked' }
	| {
			type: 'poll_twitch_enrich';
			platform_channel_ids?: string[];
	  }
	| { type: 'rollup_daily'; date?: string }
	| { type: 'discover_twitch' }
	| { type: 'discover_kick' }
	| { type: 'sync_eventsub_twitch' }
	| {
			type: 'vod_backfill_twitch';
			platform_channel_ids?: string[];
			limit?: number;
	  };

const INGEST_PLATFORMS = ['twitch', 'kick', 'youtube'] as const;

function isPlatform(value: unknown): value is (typeof INGEST_PLATFORMS)[number] {
	return typeof value === 'string' && (INGEST_PLATFORMS as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isIngestQueueMessage(data: unknown): data is IngestQueueMessage {
	if (!data || typeof data !== 'object' || !('type' in data)) return false;
	const msg = data as Record<string, unknown>;
	switch (msg.type) {
		case 'poll_platform':
			return isPlatform(msg.platform);
		case 'poll_channel_batch':
			return isPlatform(msg.platform) && isStringArray(msg.channel_ids);
		case 'poll_twitch_catalog':
		case 'poll_twitch_sweep':
		case 'poll_twitch_game_pass':
		case 'poll_twitch_reconcile':
		case 'poll_kick_tracked':
		case 'poll_youtube_tracked':
		case 'discover_twitch':
		case 'discover_kick':
		case 'sync_eventsub_twitch':
			return true;
		case 'poll_twitch_enrich':
			return msg.platform_channel_ids === undefined || isStringArray(msg.platform_channel_ids);
		case 'vod_backfill_twitch':
			return (
				(msg.platform_channel_ids === undefined || isStringArray(msg.platform_channel_ids)) &&
				(msg.limit === undefined || typeof msg.limit === 'number')
			);
		case 'rollup_daily':
			return msg.date === undefined || typeof msg.date === 'string';
		default:
			return false;
	}
}

/** Accepts JSON string (legacy) or object bodies from `send` / `sendBatch`. */
export function parseQueueBody(body: unknown): IngestQueueMessage | null {
	if (isIngestQueueMessage(body)) return body;
	if (typeof body !== 'string') return null;
	try {
		const data = JSON.parse(body) as unknown;
		if (isIngestQueueMessage(data)) return data;
	} catch {
		/* invalid */
	}
	return null;
}
