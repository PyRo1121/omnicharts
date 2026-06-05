/** Round-robin offset into tracked-channel list for EventSub subscription sync. */
export const EVENTSUB_SYNC_CURSOR_KEY = 'eventsub_sync_cursor';

export async function getEventSubSyncCursor(db: D1Database): Promise<number> {
	const row = await db
		.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`)
		.bind(EVENTSUB_SYNC_CURSOR_KEY)
		.first<{ value: string }>();
	if (!row?.value) return 0;
	const n = Number.parseInt(row.value, 10);
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function setEventSubSyncCursor(db: D1Database, index: number): Promise<void> {
	const safe = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
	await db
		.prepare(
			`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
		)
		.bind(EVENTSUB_SYNC_CURSOR_KEY, String(safe))
		.run();
}
