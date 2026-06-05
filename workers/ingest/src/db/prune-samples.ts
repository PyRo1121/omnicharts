/** Hot window for viewer_samples in D1 — docs/06-storage-and-rollup-design.md */

export const VIEWER_SAMPLE_RETENTION_DAYS = 14;

/** Rows deleted per statement (D1/SQLite safe batching). */
export const VIEWER_SAMPLE_DELETE_BATCH_SIZE = 500;

export function viewerSampleRetentionCutoffIso(now = new Date()): string {
	const cutoff = new Date(now);
	cutoff.setUTCDate(cutoff.getUTCDate() - VIEWER_SAMPLE_RETENTION_DAYS);
	return cutoff.toISOString();
}

/**
 * Delete viewer_samples older than the retention window in bounded batches.
 */
export async function pruneViewerSamplesOlderThanRetention(
	db: D1Database,
	now = new Date()
): Promise<number> {
	const cutoff = viewerSampleRetentionCutoffIso(now);
	let totalDeleted = 0;

	for (;;) {
		const result = await db
			.prepare(
				`DELETE FROM viewer_samples
         WHERE id IN (
           SELECT id FROM viewer_samples
           WHERE sampled_at < ?
           LIMIT ?
         )`
			)
			.bind(cutoff, VIEWER_SAMPLE_DELETE_BATCH_SIZE)
			.run();

		const deleted = result.meta.changes ?? 0;
		totalDeleted += deleted;
		if (deleted < VIEWER_SAMPLE_DELETE_BATCH_SIZE) break;
	}

	return totalDeleted;
}
