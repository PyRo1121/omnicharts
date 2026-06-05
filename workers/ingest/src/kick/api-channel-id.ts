/** Kick Public API `channel_id` (distinct from `broadcaster_user_id`) for session key parity. */

const keyFor = (broadcasterUserId: string) => `kick_api_channel_id:${broadcasterUserId}`;

export async function recordKickApiChannelId(
	db: D1Database,
	broadcasterUserId: string,
	channelId: number
): Promise<void> {
	if (!Number.isFinite(channelId)) return;
	await db
		.prepare(
			`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
		)
		.bind(keyFor(broadcasterUserId), String(channelId))
		.run();
}

export async function resolveKickApiChannelId(
	db: D1Database,
	broadcasterUserId: string
): Promise<number | null> {
	const row = await db
		.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`)
		.bind(keyFor(broadcasterUserId))
		.first<{ value: string }>();
	if (!row?.value) return null;
	const parsed = Number(row.value);
	return Number.isFinite(parsed) ? parsed : null;
}
