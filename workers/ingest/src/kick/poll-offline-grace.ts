/** Consecutive poll misses before closing open Kick sessions (transient API gaps). */

const missKey = (broadcasterUserId: string) => `kick_poll_miss:${broadcasterUserId}`;

export const KICK_OFFLINE_MISS_THRESHOLD = 3;

export async function resetKickPollMissCounters(db: D1Database, broadcasterIds: string[]): Promise<void> {
	if (broadcasterIds.length === 0) return;
	const keys = broadcasterIds.map(missKey);
	await db
		.prepare(`DELETE FROM ingest_metadata WHERE key IN (SELECT value FROM json_each(?))`)
		.bind(JSON.stringify(keys))
		.run();
}

/** Returns broadcaster ids safe to treat as offline for session close after grace period. */
export async function kickBroadcasterIdsReadyToClose(
	db: D1Database,
	broadcasterIds: string[],
	liveBroadcasterIds: Set<string>,
): Promise<string[]> {
	const offlineCandidates = broadcasterIds.filter((id) => !liveBroadcasterIds.has(id));
	const liveIds = broadcasterIds.filter((id) => liveBroadcasterIds.has(id));
	await resetKickPollMissCounters(db, liveIds);

	const toClose: string[] = [];
	for (const id of offlineCandidates) {
		const key = missKey(id);
		const row = await db.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`).bind(key).first<{ value: string }>();
		const misses = (row?.value ? Number(row.value) : 0) + 1;
		if (!Number.isFinite(misses)) continue;

		await db
			.prepare(
				`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			)
			.bind(key, String(misses))
			.run();

		if (misses >= KICK_OFFLINE_MISS_THRESHOLD) {
			toClose.push(id);
			await db.prepare(`DELETE FROM ingest_metadata WHERE key = ?`).bind(key).run();
		}
	}

	return toClose;
}
