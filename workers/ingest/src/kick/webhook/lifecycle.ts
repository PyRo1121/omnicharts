import { PLATFORM_KICK } from '@omnicharts/domain';
import type { KickLivestreamStatusUpdatedEvent } from './types';
import { requireDb } from '../../worker-bindings';

const nowIso = () => new Date().toISOString();

function parseLivestreamStatusUpdated(
	body: unknown
): KickLivestreamStatusUpdatedEvent | null {
	if (!body || typeof body !== 'object') return null;
	const event = body as Record<string, unknown>;
	const broadcaster = event.broadcaster;
	if (!broadcaster || typeof broadcaster !== 'object') return null;
	const b = broadcaster as Record<string, unknown>;
	if (typeof b.user_id !== 'number' || !Number.isFinite(b.user_id)) return null;
	if (typeof b.channel_slug !== 'string' || !b.channel_slug.trim()) return null;
	if (typeof event.is_live !== 'boolean') return null;

	return {
		broadcaster: {
			user_id: b.user_id,
			username: typeof b.username === 'string' ? b.username : undefined,
			channel_slug: b.channel_slug.trim()
		},
		is_live: event.is_live,
		title: typeof event.title === 'string' ? event.title : undefined,
		started_at: typeof event.started_at === 'string' ? event.started_at : undefined,
		ended_at:
			event.ended_at === null || typeof event.ended_at === 'string' ? event.ended_at : undefined
	};
}

/** Session boundary only — polling remains HW/AV source of truth (ADR-003). */
export async function applyKickLivestreamStatusUpdated(
	env: Env,
	event: KickLivestreamStatusUpdatedEvent
): Promise<void> {
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
       END`
		)
		.bind(channelId, PLATFORM_KICK, broadcasterId, slug, displayName, now, now)
		.run();

	const row = await db
		.prepare(`SELECT id FROM channels WHERE platform_id = ? AND platform_channel_id = ?`)
		.bind(PLATFORM_KICK, broadcasterId)
		.first<{ id: string }>();

	const resolvedChannelId = row?.id ?? channelId;

	if (event.is_live) {
		const startedAt = event.started_at ?? now;
		const platformStreamId = `${broadcasterId}-${startedAt}`;
		const sessionId = `kick-sess-wh-${broadcasterId}-${startedAt.replace(/[^0-9]/g, '')}`;

		await db
			.prepare(
				`INSERT INTO stream_sessions (
         id, channel_id, platform_stream_id, title, started_at, ended_at
       ) VALUES (?, ?, ?, ?, ?, NULL)
       ON CONFLICT(channel_id, platform_stream_id) DO UPDATE SET
         title = excluded.title,
         started_at = excluded.started_at,
         ended_at = NULL`
			)
			.bind(sessionId, resolvedChannelId, platformStreamId, event.title ?? null, startedAt)
			.run();
		return;
	}

	const endedAt = event.ended_at ?? now;
	await db
		.prepare(
			`UPDATE stream_sessions SET ended_at = ?
     WHERE channel_id = ? AND ended_at IS NULL`
		)
		.bind(endedAt, resolvedChannelId)
		.run();
}

export { parseLivestreamStatusUpdated };
