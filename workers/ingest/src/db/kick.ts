import { PLATFORM_KICK } from '@omnicharts/domain';

/** Shared WHERE for tracked Kick broadcaster rows. */
const TRACKED_KICK_CHANNEL_SQL = `
  platform_id = ?
  AND ingest_state = 'tracked'
  AND platform_channel_id GLOB '[0-9]*'
  AND platform_channel_id NOT GLOB 'dev-*'
  AND id NOT LIKE 'dev-seed-ch-%'`;

export async function listKickChannelIdsToPoll(db: D1Database, limit: number): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT platform_channel_id FROM channels
       WHERE ${TRACKED_KICK_CHANNEL_SQL}
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT ?`,
		)
		.bind(PLATFORM_KICK, limit)
		.all<{ platform_channel_id: string }>();

	return (results ?? []).map((r) => r.platform_channel_id);
}
