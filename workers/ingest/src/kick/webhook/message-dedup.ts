/** Kick webhook message_id dedup (~10m TTL in ingest_metadata). */

export const KICK_WEBHOOK_DEDUP_TTL_MS = 10 * 60 * 1000;

const keyFor = (messageId: string) => `kick_webhook_msg:${messageId}`;

type DedupEntry = { seenAt: string };

function parseEntry(value: string): DedupEntry | null {
	try {
		const parsed = JSON.parse(value) as DedupEntry;
		if (typeof parsed.seenAt !== 'string') return null;
		return parsed;
	} catch {
		return null;
	}
}

function isFresh(entry: DedupEntry): boolean {
	const age = Date.now() - Date.parse(entry.seenAt);
	return Number.isFinite(age) && age >= 0 && age < KICK_WEBHOOK_DEDUP_TTL_MS;
}

export async function isDuplicateKickWebhookMessage(
	db: D1Database,
	messageId: string
): Promise<boolean> {
	const key = keyFor(messageId);
	const row = await db
		.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`)
		.bind(key)
		.first<{ value: string }>();
	if (!row?.value) return false;
	const entry = parseEntry(row.value);
	if (entry !== null && isFresh(entry)) return true;
	await db.prepare(`DELETE FROM ingest_metadata WHERE key = ?`).bind(key).run();
	return false;
}

export async function recordKickWebhookMessageId(db: D1Database, messageId: string): Promise<void> {
	const payload: DedupEntry = { seenAt: new Date().toISOString() };
	await db
		.prepare(
			`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
		)
		.bind(keyFor(messageId), JSON.stringify(payload))
		.run();
}

/** Synchronous claim before processing — returns false when another delivery owns message_id. */
export async function claimKickWebhookMessageId(
	db: D1Database,
	messageId: string
): Promise<boolean> {
	const key = keyFor(messageId);
	const payload: DedupEntry = { seenAt: new Date().toISOString() };
	const result = await db
		.prepare(
			`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO NOTHING`
		)
		.bind(key, JSON.stringify(payload))
		.run();

	if ((result.meta?.changes ?? 0) > 0) return true;

	const row = await db
		.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`)
		.bind(key)
		.first<{ value: string }>();
	if (!row?.value) return true;

	const entry = parseEntry(row.value);
	if (entry !== null && isFresh(entry)) return false;

	await db.prepare(`DELETE FROM ingest_metadata WHERE key = ?`).bind(key).run();
	const retry = await db
		.prepare(
			`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO NOTHING`
		)
		.bind(key, JSON.stringify(payload))
		.run();
	return (retry.meta?.changes ?? 0) > 0;
}
