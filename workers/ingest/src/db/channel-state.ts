import { PLATFORM_TWITCH } from '@omnicharts/domain';
import { runD1Batches } from './d1-batch';

const nowIso = () => new Date().toISOString();

/** tracked → dormant when not seen live within `inactiveDays` (uses `last_seen_at`). */
export async function markChannelsDormantWithoutRecentActivity(db: D1Database, inactiveDays: number): Promise<number> {
	const result = await db
		.prepare(
			`UPDATE channels
       SET ingest_state = 'dormant'
       WHERE platform_id = ?
         AND ingest_state = 'tracked'
         AND last_seen_at < datetime('now', '-' || ? || ' days')`,
		)
		.bind(PLATFORM_TWITCH, String(inactiveDays))
		.run();

	return result.meta.changes ?? 0;
}

/** Any state → retired (Helix user gone). */
export async function markChannelRetired(db: D1Database, platformChannelId: string): Promise<void> {
	await batchMarkChannelsRetired(db, [platformChannelId]);
}

/** Batch retire channels missing from Helix GET /users. */
export async function batchMarkChannelsRetired(db: D1Database, platformChannelIds: string[]): Promise<number> {
	if (platformChannelIds.length === 0) return 0;
	const statements = platformChannelIds.map((platformChannelId) =>
		db
			.prepare(
				`UPDATE channels
       SET ingest_state = 'retired'
       WHERE platform_id = ? AND platform_channel_id = ?
         AND ingest_state != 'retired'`,
			)
			.bind(PLATFORM_TWITCH, platformChannelId),
	);
	await runD1Batches(db, statements, { scope: 'profile:retire' });
	return platformChannelIds.length;
}

export async function recordSlugChangeIfNeeded(
	db: D1Database,
	opts: { channelId: string; oldSlug: string; newSlug: string },
): Promise<void> {
	if (opts.oldSlug === opts.newSlug) return;

	await db
		.prepare(
			`INSERT INTO slug_history (channel_id, old_slug, new_slug, platform_id, changed_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(platform_id, old_slug) DO NOTHING`,
		)
		.bind(opts.channelId, opts.oldSlug, opts.newSlug, PLATFORM_TWITCH, nowIso())
		.run();
}
