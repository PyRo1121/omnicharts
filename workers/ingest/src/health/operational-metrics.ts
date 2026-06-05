import { PLATFORM_KICK, PLATFORM_TWITCH, PLATFORM_YOUTUBE } from '@omnicharts/domain';
import {
	countFromBatchRow,
	maxSampleFromBatchRow,
	normalizeBatchResult,
	TWITCH_DISCOVERY_24H_SQL,
	TWITCH_LIVE_COUNT_SQL,
	TWITCH_MAX_SAMPLE_SQL,
} from '@omnicharts/rollup';

export type IngestOperationalMetrics = {
	channels_live: number;
	channels_live_by_platform: { twitch: number; kick: number; youtube: number };
	discovery_new_24h: number;
	ingest_lag_seconds: { twitch: number | null };
};

export { LIVE_COUNT_RECENT_SAMPLE_MINUTES, TWITCH_LIVE_COUNT_SQL } from '@omnicharts/rollup';

export function ingestLagSecondsFromMaxSample(maxSampledAt: string | null | undefined): number | null {
	if (!maxSampledAt) return null;
	const lagMs = Date.now() - Date.parse(maxSampledAt);
	if (!Number.isFinite(lagMs) || lagMs < 0) return null;
	return Math.round(lagMs / 1000);
}

export async function fetchIngestOperationalMetrics(db: D1Database): Promise<IngestOperationalMetrics> {
	const [twitchLiveBatch, kickLiveBatch, youtubeLiveBatch, discoveryBatch, sampleBatch] = await db.batch([
		db.prepare(TWITCH_LIVE_COUNT_SQL).bind(PLATFORM_TWITCH),
		db.prepare(TWITCH_LIVE_COUNT_SQL).bind(PLATFORM_KICK),
		db.prepare(TWITCH_LIVE_COUNT_SQL).bind(PLATFORM_YOUTUBE),
		db.prepare(TWITCH_DISCOVERY_24H_SQL).bind(PLATFORM_TWITCH),
		db.prepare(TWITCH_MAX_SAMPLE_SQL).bind(PLATFORM_TWITCH),
	]);

	const channelsLiveByPlatform = {
		twitch: countFromBatchRow(normalizeBatchResult(twitchLiveBatch)),
		kick: countFromBatchRow(normalizeBatchResult(kickLiveBatch)),
		youtube: countFromBatchRow(normalizeBatchResult(youtubeLiveBatch)),
	};

	return {
		channels_live: channelsLiveByPlatform.twitch + channelsLiveByPlatform.kick + channelsLiveByPlatform.youtube,
		channels_live_by_platform: channelsLiveByPlatform,
		discovery_new_24h: countFromBatchRow(normalizeBatchResult(discoveryBatch)),
		ingest_lag_seconds: {
			twitch: ingestLagSecondsFromMaxSample(maxSampleFromBatchRow(normalizeBatchResult(sampleBatch))),
		},
	};
}

export function healthStatusFromLag(
	base: 'ok' | 'unavailable',
	lagSeconds: number | null,
	degradedThresholdSeconds = 300,
): 'ok' | 'degraded' | 'unavailable' {
	if (base === 'unavailable') return 'unavailable';
	if (lagSeconds != null && lagSeconds > degradedThresholdSeconds) return 'degraded';
	return 'ok';
}
