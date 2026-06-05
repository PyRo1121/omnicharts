import { PLATFORM_YOUTUBE } from '@omnicharts/domain';
import {
	chunkArray,
	D1_BATCH_MAX_STATEMENTS,
	maxRowsPerInsert,
	runD1Batches
} from './d1-batch';
import { batchCloseStaleOpenSessionsForChannels } from './session-lifecycle';
import type { SampleArchiveRow } from '../r2/sample-archive';
import type { YoutubeVideoItem } from '../youtube/types';
import {
	parseYoutubeConcurrentViewers,
	youtubePlatformStreamId,
	youtubeSessionRowId
} from '../youtube/stream-fields';

const nowIso = () => new Date().toISOString();

async function fetchOpenSessionsByChannelId(
	db: D1Database,
	channelIds: string[]
): Promise<Map<string, { id: string; platform_stream_id: string; started_at: string }>> {
	const latest = new Map<string, { id: string; platform_stream_id: string; started_at: string }>();
	if (channelIds.length === 0) return latest;

	for (const batch of chunkArray(channelIds, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = batch.map(() => '?').join(', ');
		const { results } = await db
			.prepare(
				`SELECT id, channel_id, platform_stream_id, started_at FROM stream_sessions
         WHERE channel_id IN (${placeholders}) AND ended_at IS NULL`
			)
			.bind(...batch)
			.all<{ id: string; channel_id: string; platform_stream_id: string; started_at: string }>();

		for (const row of results ?? []) {
			const prev = latest.get(row.channel_id);
			if (!prev || row.started_at > prev.started_at) {
				latest.set(row.channel_id, {
					id: row.id,
					platform_stream_id: row.platform_stream_id,
					started_at: row.started_at
				});
			}
		}
	}
	return latest;
}

async function insertViewerSamplesMultiRow(
	db: D1Database,
	rows: { sessionRowId: string; sampledAt: string; viewerCount: number }[]
): Promise<void> {
	if (rows.length === 0) return;
	const cols = 3;
	const rowCap = maxRowsPerInsert(cols);

	for (const chunk of chunkArray(rows, rowCap)) {
		const placeholders = chunk.map(() => '(?, ?, ?)').join(', ');
		const binds = chunk.flatMap((r) => [r.sessionRowId, r.sampledAt, r.viewerCount]);
		await db
			.prepare(
				`INSERT INTO viewer_samples (stream_session_id, sampled_at, viewer_count)
         VALUES ${placeholders}
         ON CONFLICT(stream_session_id, sampled_at) DO NOTHING`
			)
			.bind(...binds)
			.run();
	}
}

export type YoutubeLiveSampleInput = {
	channelId: string;
	video: YoutubeVideoItem;
};

export async function batchRecordYoutubeLiveSamples(
	db: D1Database,
	inputs: YoutubeLiveSampleInput[],
	batchOpts?: { env?: Env; scope?: string }
): Promise<SampleArchiveRow[]> {
	if (inputs.length === 0) return [];

	const now = nowIso();
	const channelIds = inputs.map((i) => i.channelId);
	const openByChannel = await fetchOpenSessionsByChannelId(db, channelIds);

	const sessionInsertStatements: D1PreparedStatement[] = [];
	const sessionUpdateStatements: D1PreparedStatement[] = [];
	const staleSessionCloses: { channelId: string; platformStreamId: string }[] = [];
	const sampleRows: { sessionRowId: string; sampledAt: string; viewerCount: number }[] = [];
	const archive: SampleArchiveRow[] = [];

	for (const { channelId, video } of inputs) {
		const viewers = parseYoutubeConcurrentViewers(video.liveStreamingDetails?.concurrentViewers);
		if (viewers == null) continue;

		const platformStreamId = youtubePlatformStreamId(video.id);
		const startedAt = video.liveStreamingDetails?.actualStartTime ?? now;
		const sessionId = youtubeSessionRowId(video.snippet.channelId, startedAt);
		const openSession = openByChannel.get(channelId);

		let sessionRowId = openSession?.id ?? sessionId;

		if (openSession && openSession.platform_stream_id !== platformStreamId) {
			staleSessionCloses.push({ channelId, platformStreamId });
			openByChannel.delete(channelId);
			sessionRowId = sessionId;
		}

		if (!openSession || openSession.platform_stream_id !== platformStreamId) {
			sessionInsertStatements.push(
				db
					.prepare(
						`INSERT INTO stream_sessions (
               id, channel_id, platform_stream_id, title, started_at, stream_type
             ) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(channel_id, platform_stream_id) DO UPDATE SET
               title = excluded.title,
               stream_type = excluded.stream_type`
					)
					.bind(sessionRowId, channelId, platformStreamId, video.snippet.title, startedAt, 'live')
			);
		} else {
			sessionUpdateStatements.push(
				db
					.prepare(`UPDATE stream_sessions SET title = ? WHERE id = ?`)
					.bind(video.snippet.title, sessionRowId)
			);
		}

		sampleRows.push({
			sessionRowId,
			sampledAt: now,
			viewerCount: viewers
		});
		archive.push({
			stream_session_id: sessionRowId,
			sampled_at: now,
			viewer_count: viewers,
			platform: PLATFORM_YOUTUBE
		});
	}

	await batchCloseStaleOpenSessionsForChannels(db, staleSessionCloses, now, {
		scope: batchOpts?.scope ? `${batchOpts.scope}:stale_session_close` : undefined,
		env: batchOpts?.env
	});
	await runD1Batches(db, sessionInsertStatements, {
		scope: batchOpts?.scope ? `${batchOpts.scope}:session_insert` : undefined,
		env: batchOpts?.env
	});
	await runD1Batches(db, sessionUpdateStatements, {
		scope: batchOpts?.scope ? `${batchOpts.scope}:session_update` : undefined,
		env: batchOpts?.env
	});
	await insertViewerSamplesMultiRow(db, sampleRows);

	return archive;
}

export async function clearYoutubeLiveVideoIds(
	db: D1Database,
	channelRowIds: string[],
	batchOpts?: { env?: Env; scope?: string }
): Promise<void> {
	if (channelRowIds.length === 0) return;

	const statements: D1PreparedStatement[] = [];
	for (const batch of chunkArray(channelRowIds, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = batch.map(() => '?').join(', ');
		statements.push(
			db
				.prepare(
					`UPDATE channels SET youtube_live_video_id = NULL
           WHERE platform_id = ? AND id IN (${placeholders})`
				)
				.bind(PLATFORM_YOUTUBE, ...batch)
		);
	}

	await runD1Batches(db, statements, {
		scope: batchOpts?.scope ?? 'youtube:poll:clear_live_video_id',
		env: batchOpts?.env
	});
}
