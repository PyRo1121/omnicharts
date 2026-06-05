import { PLATFORM_KICK, PLATFORM_TWITCH } from '@omnicharts/domain';
import type { KickChannel } from '../kick/types';
import { slugify } from '../twitch/slug';
import type { HelixUser } from '../twitch/helix';

const nowIso = () => new Date().toISOString();

export type WatchlistUpsertResult = {
	channelId: string;
	created: boolean;
	promoted: boolean;
	skipped: boolean;
};

async function fetchChannelByPlatformSlug(
	db: D1Database,
	platform: string,
	slug: string
): Promise<{ id: string; ingest_state: string } | null> {
	return db
		.prepare(
			`SELECT id, ingest_state FROM channels
       WHERE platform_id = ? AND lower(slug) = lower(?)`
		)
		.bind(platform, slug)
		.first<{ id: string; ingest_state: string }>();
}

export async function upsertTwitchChannelFromUser(
	db: D1Database,
	user: HelixUser
): Promise<WatchlistUpsertResult> {
	const now = nowIso();
	const slug = slugify(user.login) || `user-${user.id}`;
	const channelId = `twitch-ch-${user.id}`;
	const existing = await fetchChannelByPlatformSlug(db, PLATFORM_TWITCH, slug);
	const wasTracked = existing?.ingest_state === 'tracked';

	await db
		.prepare(
			`INSERT INTO channels (
       id, platform_id, platform_channel_id, slug, display_name, avatar_url,
       first_observed_at, last_seen_at, ingest_state
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'tracked')
     ON CONFLICT(platform_id, platform_channel_id) DO UPDATE SET
       slug = excluded.slug,
       display_name = excluded.display_name,
       avatar_url = excluded.avatar_url,
       last_seen_at = excluded.last_seen_at,
       ingest_state = CASE
         WHEN channels.ingest_state = 'retired' THEN channels.ingest_state
         ELSE 'tracked'
       END`
		)
		.bind(
			channelId,
			PLATFORM_TWITCH,
			user.id,
			slug,
			user.display_name,
			user.profile_image_url || null,
			now,
			now
		)
		.run();

	const row = await db
		.prepare(`SELECT id, ingest_state FROM channels WHERE platform_id = ? AND platform_channel_id = ?`)
		.bind(PLATFORM_TWITCH, user.id)
		.first<{ id: string; ingest_state: string }>();

	const resolvedId = row?.id ?? channelId;
	const created = !existing;
	const promoted = Boolean(existing && existing.ingest_state !== 'tracked' && row?.ingest_state === 'tracked');
	const skipped = wasTracked;

	return { channelId: resolvedId, created, promoted, skipped };
}

export async function upsertKickChannelFromLookup(
	db: D1Database,
	channel: KickChannel
): Promise<WatchlistUpsertResult> {
	const now = nowIso();
	const broadcasterId = String(channel.broadcaster_user_id);
	const slug = channel.slug.trim().toLowerCase();
	const channelId = `kick-ch-${broadcasterId}`;
	const existing = await fetchChannelByPlatformSlug(db, PLATFORM_KICK, slug);
	const wasTracked = existing?.ingest_state === 'tracked';

	await db
		.prepare(
			`INSERT INTO channels (
       id, platform_id, platform_channel_id, slug, display_name,
       first_observed_at, last_seen_at, ingest_state
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'tracked')
     ON CONFLICT(platform_id, platform_channel_id) DO UPDATE SET
       slug = excluded.slug,
       display_name = excluded.display_name,
       last_seen_at = excluded.last_seen_at,
       ingest_state = CASE
         WHEN channels.ingest_state = 'retired' THEN channels.ingest_state
         ELSE 'tracked'
       END`
		)
		.bind(channelId, PLATFORM_KICK, broadcasterId, slug, slug, now, now)
		.run();

	const row = await db
		.prepare(`SELECT id, ingest_state FROM channels WHERE platform_id = ? AND platform_channel_id = ?`)
		.bind(PLATFORM_KICK, broadcasterId)
		.first<{ id: string; ingest_state: string }>();

	const resolvedId = row?.id ?? channelId;
	const created = !existing;
	const promoted = Boolean(existing && existing.ingest_state !== 'tracked' && row?.ingest_state === 'tracked');
	const skipped = wasTracked;

	return { channelId: resolvedId, created, promoted, skipped };
}
