const METADATA_PREFIX = 'follower_eod:';

import { chunkArray, D1_BATCH_MAX_STATEMENTS, runD1Batches } from './d1-batch';

function metadataKey(channelId: string): string {
	return `${METADATA_PREFIX}${channelId}`;
}

export async function fetchFollowerCountsByChannelId(db: D1Database, channelIds: string[]): Promise<Map<string, number | null>> {
	const map = new Map<string, number | null>();
	if (channelIds.length === 0) return map;

	for (const batch of chunkArray(channelIds, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = batch.map(() => '?').join(', ');
		const { results } = await db
			.prepare(`SELECT id, follower_count FROM channels WHERE id IN (${placeholders})`)
			.bind(...batch)
			.all<{ id: string; follower_count: number | null }>();

		for (const row of results ?? []) {
			map.set(row.id, row.follower_count);
		}
	}
	return map;
}

/** Prior rollup follower total from ingest_metadata (`follower_eod:{channelId}`). */
export async function fetchPriorFollowerSnapshots(db: D1Database, channelIds: string[]): Promise<Map<string, number | null>> {
	const map = new Map<string, number | null>();
	if (channelIds.length === 0) return map;

	for (const id of channelIds) map.set(id, null);

	const keys = channelIds.map(metadataKey);
	for (const batch of chunkArray(keys, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = batch.map(() => '?').join(', ');
		const { results } = await db
			.prepare(`SELECT key, value FROM ingest_metadata WHERE key IN (${placeholders})`)
			.bind(...batch)
			.all<{ key: string; value: string }>();

		for (const row of results ?? []) {
			const channelId = row.key.slice(METADATA_PREFIX.length);
			const n = Number(row.value);
			map.set(channelId, Number.isFinite(n) ? n : null);
		}
	}
	return map;
}

export function computeFollowersDelta(todayCount: number | null, priorCount: number | null): number | null {
	if (todayCount == null || priorCount == null) return null;
	return todayCount - priorCount;
}

export async function storeFollowerSnapshots(db: D1Database, snapshots: Map<string, number>): Promise<void> {
	if (snapshots.size === 0) return;

	const entries = [...snapshots.entries()];
	const statements = entries.map(([channelId, count]) =>
		db
			.prepare(
				`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			)
			.bind(metadataKey(channelId), String(count)),
	);
	await runD1Batches(db, statements);
}
