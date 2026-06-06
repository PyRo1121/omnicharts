import type { PlatformId } from '@omnicharts/domain';
import { countFromBatchRow, normalizeBatchResult, TWITCH_LIVE_COUNT_SQL, TWITCH_TRACKED_COUNT_SQL } from '@omnicharts/rollup';

export type PlatformCounts = {
	tracked: number;
	live: number;
};

/** One D1 batch for tracked + live counts (same SQL as ingest /health). */
export async function loadPlatformCountsFromD1(db: D1Database, platform: PlatformId): Promise<PlatformCounts> {
	const [trackedBatch, liveBatch] = await db.batch([
		db.prepare(TWITCH_TRACKED_COUNT_SQL).bind(platform),
		db.prepare(TWITCH_LIVE_COUNT_SQL).bind(platform),
	]);
	return {
		tracked: countFromBatchRow(normalizeBatchResult(trackedBatch)),
		live: countFromBatchRow(normalizeBatchResult(liveBatch)),
	};
}
