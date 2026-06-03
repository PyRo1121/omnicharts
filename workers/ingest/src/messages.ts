/** Queue payloads — docs/15-ingest-runbook.md */

export type IngestQueueMessage =
	| { type: 'poll_platform'; platform: 'twitch' | 'kick' | 'youtube' }
	| { type: 'poll_channel_batch'; platform: 'twitch' | 'kick' | 'youtube'; channel_ids: string[] }
	| { type: 'poll_twitch_sweep' }
	| { type: 'poll_twitch_game_pass' }
	| { type: 'poll_twitch_reconcile' }
	| {
			type: 'poll_twitch_enrich';
			platform_channel_ids?: string[];
	  }
	| { type: 'rollup_daily'; date?: string }
	| { type: 'discover_twitch' }
	| { type: 'sync_eventsub_twitch' };

function isIngestQueueMessage(data: unknown): data is IngestQueueMessage {
	return Boolean(data && typeof data === 'object' && 'type' in data);
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
