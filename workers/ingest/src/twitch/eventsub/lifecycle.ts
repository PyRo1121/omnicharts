import { PLATFORM_TWITCH } from '@omnicharts/domain';
import { slugify } from '../slug';
import type { StreamOfflineEvent, StreamOnlineEvent } from './types';
import { requireDb } from '../../worker-bindings';

const nowIso = () => new Date().toISOString();

/** Ensure channel row exists and mark live (EventSub stream.online). */
export async function applyStreamOnline(env: Env, event: StreamOnlineEvent): Promise<void> {
	const db = requireDb(env);
	const now = nowIso();
	const slug = slugify(event.broadcaster_user_login) || `user-${event.broadcaster_user_id}`;
	const channelId = `twitch-ch-${event.broadcaster_user_id}`;
	const sessionId = `twitch-sess-${event.id}`;

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
       END`,
		)
		.bind(channelId, PLATFORM_TWITCH, event.broadcaster_user_id, slug, event.broadcaster_user_name, now, now)
		.run();

	const row = await db
		.prepare(`SELECT id FROM channels WHERE platform_id = ? AND platform_channel_id = ?`)
		.bind(PLATFORM_TWITCH, event.broadcaster_user_id)
		.first<{ id: string }>();

	const resolvedChannelId = row?.id ?? channelId;

	await db
		.prepare(
			`INSERT INTO stream_sessions (
       id, channel_id, platform_stream_id, title, started_at, ended_at
     ) VALUES (?, ?, ?, NULL, ?, NULL)
     ON CONFLICT(channel_id, platform_stream_id) DO UPDATE SET
       started_at = excluded.started_at,
       ended_at = NULL`,
		)
		.bind(sessionId, resolvedChannelId, event.id, event.started_at)
		.run();

	// Close any other open sessions at stream start (not worker receipt time)
	const closeAt = event.started_at;
	await db
		.prepare(
			`UPDATE stream_sessions SET ended_at = ?
     WHERE channel_id = ? AND ended_at IS NULL AND platform_stream_id != ?`,
		)
		.bind(closeAt, resolvedChannelId, event.id)
		.run();
}

/** Close open sessions (EventSub stream.offline). */
export async function applyStreamOffline(env: Env, event: StreamOfflineEvent, opts?: { endedAt?: string }): Promise<void> {
	const db = requireDb(env);
	const endedAt =
		(typeof event.ended_at === 'string' && event.ended_at.length > 0 ? event.ended_at : undefined) ?? opts?.endedAt ?? nowIso();

	const row = await db
		.prepare(`SELECT id FROM channels WHERE platform_id = ? AND platform_channel_id = ?`)
		.bind(PLATFORM_TWITCH, event.broadcaster_user_id)
		.first<{ id: string }>();

	if (!row) return;

	await db.prepare(`UPDATE channels SET last_seen_at = ? WHERE id = ?`).bind(endedAt, row.id).run();

	await db
		.prepare(
			`UPDATE stream_sessions SET ended_at = ?
     WHERE channel_id = ? AND ended_at IS NULL`,
		)
		.bind(endedAt, row.id)
		.run();
}
