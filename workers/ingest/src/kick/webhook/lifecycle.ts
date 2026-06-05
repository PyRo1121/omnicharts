import { PLATFORM_KICK } from '@omnicharts/domain';
import { isRecord, readBoolean, readNumber, readString } from '../../json-guards';
import { closeStaleOpenSessionsForChannel } from '../../db/session-lifecycle';
import { recordKickApiChannelId, resolveKickApiChannelId } from '../api-channel-id';
import { kickPlatformStreamIdFromChannelId, kickSessionRowIdFromChannelId } from '../stream-fields';
import type { KickLivestreamStatusUpdatedEvent } from './types';
import { requireDb } from '../../worker-bindings';

const nowIso = () => new Date().toISOString();

function parseLivestreamStatusUpdated(body: unknown): KickLivestreamStatusUpdatedEvent | null {
	if (!isRecord(body)) return null;
	const broadcaster = body.broadcaster;
	if (!isRecord(broadcaster)) return null;
	const user_id = readNumber(broadcaster, 'user_id');
	const channel_slug = readString(broadcaster, 'channel_slug');
	const is_live = readBoolean(body, 'is_live');
	if (user_id == null || !channel_slug?.trim() || is_live == null) return null;

	let channelId: number | undefined;
	const eventChannelId = readNumber(body, 'channel_id');
	const broadcasterChannelId = readNumber(broadcaster, 'channel_id');
	if (eventChannelId != null) channelId = eventChannelId;
	else if (broadcasterChannelId != null) channelId = broadcasterChannelId;

	const endedAtRaw = body.ended_at;
	const ended_at = endedAtRaw === null || typeof endedAtRaw === 'string' ? endedAtRaw : undefined;

	return {
		broadcaster: {
			user_id,
			username: readString(broadcaster, 'username'),
			channel_slug: channel_slug.trim(),
			channel_id: channelId,
		},
		channel_id: channelId,
		is_live,
		title: readString(body, 'title'),
		started_at: readString(body, 'started_at'),
		ended_at,
	};
}

async function resolveKickChannelIdForSession(db: D1Database, event: KickLivestreamStatusUpdatedEvent): Promise<number> {
	const broadcasterId = String(event.broadcaster.user_id);
	if (event.channel_id != null) return event.channel_id;
	if (event.broadcaster.channel_id != null) return event.broadcaster.channel_id;

	const fromMeta = await resolveKickApiChannelId(db, broadcasterId);
	if (fromMeta != null) return fromMeta;

	return event.broadcaster.user_id;
}

/** Session boundary only — polling remains HW/AV source of truth (ADR-003). */
export async function applyKickLivestreamStatusUpdated(env: Env, event: KickLivestreamStatusUpdatedEvent): Promise<void> {
	const db = requireDb(env);
	const now = nowIso();
	const broadcasterId = String(event.broadcaster.user_id);
	const slug = event.broadcaster.channel_slug;
	const displayName = event.broadcaster.username?.trim() || slug;
	const channelId = `kick-ch-${broadcasterId}`;

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
         WHEN excluded.last_seen_at IS NOT NULL THEN 'tracked'
         ELSE channels.ingest_state
       END`,
		)
		.bind(channelId, PLATFORM_KICK, broadcasterId, slug, displayName, now, now)
		.run();

	const row = await db
		.prepare(`SELECT id FROM channels WHERE platform_id = ? AND platform_channel_id = ?`)
		.bind(PLATFORM_KICK, broadcasterId)
		.first<{ id: string }>();

	const resolvedChannelId = row?.id ?? channelId;
	const kickApiChannelId = await resolveKickChannelIdForSession(db, event);
	await recordKickApiChannelId(db, broadcasterId, kickApiChannelId);

	if (event.is_live) {
		const startedAt = event.started_at ?? now;
		const platformStreamId = kickPlatformStreamIdFromChannelId(kickApiChannelId, startedAt);
		const sessionId = kickSessionRowIdFromChannelId(kickApiChannelId, startedAt);

		await db
			.prepare(
				`INSERT INTO stream_sessions (
         id, channel_id, platform_stream_id, title, started_at, ended_at
       ) VALUES (?, ?, ?, ?, ?, NULL)
       ON CONFLICT(channel_id, platform_stream_id) DO UPDATE SET
         title = excluded.title,
         started_at = excluded.started_at,
         ended_at = NULL`,
			)
			.bind(sessionId, resolvedChannelId, platformStreamId, event.title ?? null, startedAt)
			.run();

		await closeStaleOpenSessionsForChannel(db, resolvedChannelId, platformStreamId, now);
		return;
	}

	const endedAt = event.ended_at ?? now;
	await db
		.prepare(
			`UPDATE stream_sessions SET ended_at = ?
     WHERE channel_id = ? AND ended_at IS NULL`,
		)
		.bind(endedAt, resolvedChannelId)
		.run();
}

export { parseLivestreamStatusUpdated };
