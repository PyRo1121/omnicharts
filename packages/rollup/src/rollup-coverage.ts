import type { D1Database } from './d1';

/** Inclusive UTC days from oldest channel rollup date through today. */
export async function getRollupCoverageDays(
	db: D1Database,
	now = new Date()
): Promise<number | null> {
	const row = await db
		.prepare(`SELECT MIN(date) AS oldest FROM channel_daily_rollups`)
		.first<{ oldest: string | null }>();

	if (!row?.oldest) return null;

	const oldestMs = Date.parse(`${row.oldest}T00:00:00.000Z`);
	if (Number.isNaN(oldestMs)) return null;

	const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const days = Math.floor((todayMs - oldestMs) / (24 * 60 * 60 * 1000)) + 1;
	return Math.max(0, days);
}
