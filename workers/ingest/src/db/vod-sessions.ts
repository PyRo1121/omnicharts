import { PLATFORM_TWITCH } from '@omnicharts/domain';
import type { HelixVideo } from '../twitch/helix';
import { runD1Batches } from './d1-batch';

export type VodBackfillChannelRow = {
	id: string;
	platform_channel_id: string;
	broadcaster_type: string | null;
};

export type VodSessionUpsertRow = {
	channel_id: string;
	platform_stream_id: string;
	title: string;
	started_at: string;
	ended_at: string | null;
	language: string | null;
	thumbnail_url: string | null;
	stream_type: string | null;
	duration: string | null;
	view_count: number | null;
};

const TRACKED_TWITCH_CHANNEL_SQL = `
  platform_id = ?
  AND ingest_state = 'tracked'
  AND platform_channel_id GLOB '[0-9]*'
  AND platform_channel_id NOT GLOB 'dev-*'
  AND id NOT LIKE 'dev-seed-ch-%'`;

const nowIso = () => new Date().toISOString();

export async function listChannelsForVodBackfill(
	db: D1Database,
	limit: number,
	staleBeforeIso: string
): Promise<VodBackfillChannelRow[]> {
	const { results } = await db
		.prepare(
			`SELECT id, platform_channel_id, broadcaster_type FROM channels
       WHERE ${TRACKED_TWITCH_CHANNEL_SQL}
         AND (vod_backfilled_at IS NULL OR vod_backfilled_at < ?)
       ORDER BY vod_backfilled_at ASC NULLS FIRST, last_seen_at DESC
       LIMIT ?`
		)
		.bind(PLATFORM_TWITCH, staleBeforeIso, limit)
		.all<VodBackfillChannelRow>();

	return results ?? [];
}

export async function listChannelsForVodBackfillByPlatformIds(
	db: D1Database,
	platformChannelIds: string[]
): Promise<VodBackfillChannelRow[]> {
	if (platformChannelIds.length === 0) return [];
	const placeholders = platformChannelIds.map(() => '?').join(', ');
	const { results } = await db
		.prepare(
			`SELECT id, platform_channel_id, broadcaster_type FROM channels
       WHERE ${TRACKED_TWITCH_CHANNEL_SQL}
         AND platform_channel_id IN (${placeholders})`
		)
		.bind(PLATFORM_TWITCH, ...platformChannelIds)
		.all<VodBackfillChannelRow>();

	return results ?? [];
}

export function helixVideoToVodSessionRow(
	channelId: string,
	video: HelixVideo,
	times: { started_at: string; ended_at: string | null }
): VodSessionUpsertRow {
	return {
		channel_id: channelId,
		platform_stream_id: video.id,
		title: video.title,
		started_at: times.started_at,
		ended_at: times.ended_at,
		language: video.language || null,
		thumbnail_url: video.thumbnail_url || null,
		stream_type: video.type || 'archive',
		duration: video.duration || null,
		view_count: Number.isFinite(video.view_count) ? video.view_count : null
	};
}

function prepareVodSessionUpsert(db: D1Database, row: VodSessionUpsertRow) {
	const sessionId = `twitch-vod-${row.platform_stream_id}`;
	return db
		.prepare(
			`INSERT INTO stream_sessions (
         id, channel_id, platform_stream_id, title, started_at, ended_at,
         language, thumbnail_url, stream_type, backfill_source, duration, view_count
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'vod', ?, ?)
       ON CONFLICT(channel_id, platform_stream_id) DO UPDATE SET
         title = excluded.title,
         started_at = excluded.started_at,
         ended_at = excluded.ended_at,
         language = excluded.language,
         thumbnail_url = excluded.thumbnail_url,
         stream_type = excluded.stream_type,
         duration = excluded.duration,
         view_count = excluded.view_count,
         backfill_source = 'vod'
       WHERE stream_sessions.backfill_source IS NULL OR stream_sessions.backfill_source = 'vod'`
		)
		.bind(
			sessionId,
			row.channel_id,
			row.platform_stream_id,
			row.title,
			row.started_at,
			row.ended_at,
			row.language,
			row.thumbnail_url,
			row.stream_type,
			row.duration,
			row.view_count
		);
}

export async function batchUpsertVodSessions(
	db: D1Database,
	rows: VodSessionUpsertRow[]
): Promise<number> {
	if (rows.length === 0) return 0;
	const statements = rows.map((row) => prepareVodSessionUpsert(db, row));
	await runD1Batches(db, statements, { scope: 'vod:backfill' });
	return rows.length;
}

export async function markChannelsVodBackfilled(
	db: D1Database,
	channelIds: string[]
): Promise<void> {
	if (channelIds.length === 0) return;
	const now = nowIso();
	const statements = channelIds.map((channelId) =>
		db
			.prepare(`UPDATE channels SET vod_backfilled_at = ? WHERE id = ?`)
			.bind(now, channelId)
	);
	await runD1Batches(db, statements, { scope: 'vod:backfill:mark' });
}
