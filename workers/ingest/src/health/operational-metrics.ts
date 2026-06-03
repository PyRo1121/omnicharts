import { TWITCH_PLATFORM_ID } from '../twitch/config';

export type IngestOperationalMetrics = {
	channels_live: number;
	discovery_new_24h: number;
	ingest_lag_seconds: { twitch: number | null };
};

const TWITCH_LIVE_COUNT_SQL = `SELECT COUNT(*) AS n FROM stream_sessions ss
       INNER JOIN channels c ON c.id = ss.channel_id
       WHERE c.platform_id = ? AND ss.ended_at IS NULL`;

const TWITCH_DISCOVERY_24H_SQL = `SELECT COUNT(*) AS n FROM channels
       WHERE platform_id = ?
         AND first_observed_at >= datetime('now', '-1 day')`;

const TWITCH_MAX_SAMPLE_SQL = `SELECT MAX(vs.sampled_at) AS max_sampled_at
       FROM viewer_samples vs
       INNER JOIN stream_sessions ss ON ss.id = vs.stream_session_id
       INNER JOIN channels c ON c.id = ss.channel_id
       WHERE c.platform_id = ?`;

export function ingestLagSecondsFromMaxSample(
	maxSampledAt: string | null | undefined
): number | null {
	if (!maxSampledAt) return null;
	const lagMs = Date.now() - Date.parse(maxSampledAt);
	if (!Number.isFinite(lagMs) || lagMs < 0) return null;
	return Math.round(lagMs / 1000);
}

function countFromBatchRow(batchEntry: D1Result): number {
	const row = batchEntry.results?.[0] as { n?: number } | undefined;
	return row?.n ?? 0;
}

function maxSampleFromBatchRow(batchEntry: D1Result): string | null {
	const row = batchEntry.results?.[0] as { max_sampled_at?: string | null } | undefined;
	return row?.max_sampled_at ?? null;
}

export async function fetchIngestOperationalMetrics(
	db: D1Database
): Promise<IngestOperationalMetrics> {
	const [liveBatch, discoveryBatch, sampleBatch] = await db.batch([
		db.prepare(TWITCH_LIVE_COUNT_SQL).bind(TWITCH_PLATFORM_ID),
		db.prepare(TWITCH_DISCOVERY_24H_SQL).bind(TWITCH_PLATFORM_ID),
		db.prepare(TWITCH_MAX_SAMPLE_SQL).bind(TWITCH_PLATFORM_ID)
	]);

	return {
		channels_live: countFromBatchRow(liveBatch),
		discovery_new_24h: countFromBatchRow(discoveryBatch),
		ingest_lag_seconds: {
			twitch: ingestLagSecondsFromMaxSample(maxSampleFromBatchRow(sampleBatch))
		}
	};
}

export function healthStatusFromLag(
	base: 'ok' | 'unavailable',
	lagSeconds: number | null,
	degradedThresholdSeconds = 300
): 'ok' | 'degraded' | 'unavailable' {
	if (base === 'unavailable') return 'unavailable';
	if (lagSeconds != null && lagSeconds > degradedThresholdSeconds) return 'degraded';
	return 'ok';
}
