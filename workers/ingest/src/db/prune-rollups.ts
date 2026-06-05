/** Daily rollup hot window in D1 — docs/06-storage-and-rollup-design.md */

export const DAILY_ROLLUP_RETENTION_DAYS = 90;

/** Rows deleted per statement (D1/SQLite safe batching). */
export const DAILY_ROLLUP_DELETE_BATCH_SIZE = 500;

export function dailyRollupRetentionCutoffDate(now = new Date()): string {
	const cutoff = new Date(now);
	cutoff.setUTCDate(cutoff.getUTCDate() - DAILY_ROLLUP_RETENTION_DAYS);
	return cutoff.toISOString().slice(0, 10);
}

async function pruneTableOlderThanCutoff(
	db: D1Database,
	table: 'channel_daily_rollups' | 'game_daily_rollups',
	cutoff: string,
): Promise<number> {
	let totalDeleted = 0;

	for (;;) {
		const result = await db
			.prepare(
				`DELETE FROM ${table}
         WHERE rowid IN (
           SELECT rowid FROM ${table}
           WHERE date < ?
           LIMIT ?
         )`,
			)
			.bind(cutoff, DAILY_ROLLUP_DELETE_BATCH_SIZE)
			.run();

		const deleted = result.meta?.changes ?? 0;
		totalDeleted += deleted;
		if (deleted < DAILY_ROLLUP_DELETE_BATCH_SIZE) break;
	}

	return totalDeleted;
}

/**
 * Delete channel/game daily rollups older than the retention window in bounded batches.
 */
export async function pruneDailyRollupsOlderThanRetention(
	db: D1Database,
	now = new Date(),
): Promise<{ channelRows: number; gameRows: number }> {
	const cutoff = dailyRollupRetentionCutoffDate(now);
	const channelRows = await pruneTableOlderThanCutoff(db, 'channel_daily_rollups', cutoff);
	const gameRows = await pruneTableOlderThanCutoff(db, 'game_daily_rollups', cutoff);
	return { channelRows, gameRows };
}
