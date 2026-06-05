import { PLATFORM_TWITCH } from '@omnicharts/domain';
import {
	countFromBatchRow,
	maxSampleFromBatchRow,
	TWITCH_DISCOVERY_24H_SQL,
	TWITCH_LIVE_COUNT_SQL,
	TWITCH_MAX_SAMPLE_SQL,
	type D1BatchResult
} from '@omnicharts/rollup';

export type IngestOperationalMetrics = {
	channels_live: number;
	discovery_new_24h: number;
	ingest_lag_seconds: { twitch: number | null };
};

export {
	LIVE_COUNT_RECENT_SAMPLE_MINUTES,
	TWITCH_LIVE_COUNT_SQL
} from '@omnicharts/rollup';

export function ingestLagSecondsFromMaxSample(
	maxSampledAt: string | null | undefined
): number | null {
	if (!maxSampledAt) return null;
	const lagMs = Date.now() - Date.parse(maxSampledAt);
	if (!Number.isFinite(lagMs) || lagMs < 0) return null;
	return Math.round(lagMs / 1000);
}

export async function fetchIngestOperationalMetrics(
	db: D1Database
): Promise<IngestOperationalMetrics> {
	const [liveBatch, discoveryBatch, sampleBatch] = await db.batch([
		db.prepare(TWITCH_LIVE_COUNT_SQL).bind(PLATFORM_TWITCH),
		db.prepare(TWITCH_DISCOVERY_24H_SQL).bind(PLATFORM_TWITCH),
		db.prepare(TWITCH_MAX_SAMPLE_SQL).bind(PLATFORM_TWITCH)
	]);

	return {
		channels_live: countFromBatchRow(liveBatch as D1BatchResult),
		discovery_new_24h: countFromBatchRow(discoveryBatch as D1BatchResult),
		ingest_lag_seconds: {
			twitch: ingestLagSecondsFromMaxSample(maxSampleFromBatchRow(sampleBatch as D1BatchResult))
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
