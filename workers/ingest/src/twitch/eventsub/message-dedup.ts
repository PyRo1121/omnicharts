import { parseDedupEntry } from '../../json-guards';

/** Twitch EventSub webhook message_id dedup (~10m TTL in ingest_metadata).
 *  Stale keys use TTL-on-read: `isDuplicateEventSubMessage` ignores expired entries and deletes them. */

export const EVENTSUB_MESSAGE_DEDUP_TTL_MS = 10 * 60 * 1000;

const keyFor = (messageId: string) => `eventsub_msg:${messageId}`;

type DedupEntry = { seenAt: string };

function parseEntry(value: string): DedupEntry | null {
	return parseDedupEntry(value);
}

function isFresh(entry: DedupEntry): boolean {
	const age = Date.now() - Date.parse(entry.seenAt);
	return Number.isFinite(age) && age >= 0 && age < EVENTSUB_MESSAGE_DEDUP_TTL_MS;
}

/** True when message_id was seen within TTL (safe to ack without re-processing). */
export async function isDuplicateEventSubMessage(db: D1Database, messageId: string): Promise<boolean> {
	const key = keyFor(messageId);
	const row = await db.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`).bind(key).first<{ value: string }>();
	if (!row?.value) return false;
	const entry = parseEntry(row.value);
	if (entry !== null && isFresh(entry)) return true;
	// TTL-on-read prune — Twitch only retries ~10m; stale rows need not accumulate.
	await db.prepare(`DELETE FROM ingest_metadata WHERE key = ?`).bind(key).run();
	return false;
}

/** Record message_id after successful handling (or before idempotent no-op). */
export async function recordEventSubMessageId(db: D1Database, messageId: string): Promise<void> {
	const payload: DedupEntry = { seenAt: new Date().toISOString() };
	await db
		.prepare(
			`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		)
		.bind(keyFor(messageId), JSON.stringify(payload))
		.run();
}
