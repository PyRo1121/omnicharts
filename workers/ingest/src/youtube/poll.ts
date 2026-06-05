import { PLATFORM_YOUTUBE } from '@omnicharts/domain';
import { batchRecordYoutubeLiveSamples, clearYoutubeLiveVideoIds, type YoutubeLiveSampleInput } from '../db/youtube-live-batch';
import { listYoutubePollTargets, listYoutubeTrackedMissingLiveVideoId, setYoutubeLiveVideoId, type YoutubePollTarget } from '../db/youtube';
import { resolveYoutubeLiveVideoId } from './live-video-id';
import { runD1Batches } from '../db/d1-batch';
import { closeOpenSessionsForPlatformChannelIds } from '../db/session-lifecycle';
import { archiveSampleBatch } from '../r2/sample-archive';
import { ingestWarn } from '../log';
import { requireDb } from '../worker-bindings';
import { YoutubeDataApiClient } from './api';
import { youtubeApiKeyConfigured, youtubeMaxTrackedFromEnv, youtubeMinViewersFromEnv, YOUTUBE_VIDEOS_BATCH_SIZE } from './config';
import { isYoutubeConcurrentViewersKnown, isYoutubeLive, parseYoutubeConcurrentViewers, youtubeStreamEnded } from './stream-fields';

export type YoutubePollResult = {
	batches: number;
	liveVideos: number;
	samplesWritten: number;
	skipped?: 'NEEDS_API';
};

export function youtubePollNeedsApiReason(env: Env): string | null {
	if (!youtubeApiKeyConfigured(env)) {
		return 'YOUTUBE_API_KEY not configured';
	}
	return null;
}

/** Tracked-catalog poll — ≤50 video ids per videos.list batch (docs/05). */
export async function runYoutubeCatalogPoll(env: Env): Promise<YoutubePollResult> {
	const needsApi = youtubePollNeedsApiReason(env);
	if (needsApi) {
		ingestWarn('[youtube] poll skipped — NEEDS_API:', needsApi);
		return { batches: 0, liveVideos: 0, samplesWritten: 0, skipped: 'NEEDS_API' };
	}

	const db = requireDb(env);
	const limit = youtubeMaxTrackedFromEnv(env);
	const client = new YoutubeDataApiClient(env);
	await bootstrapYoutubeLiveVideoIds(env, db, client, limit);
	const targets = await listYoutubePollTargets(db, limit);
	const totals: YoutubePollResult = { batches: 0, liveVideos: 0, samplesWritten: 0 };

	for (let i = 0; i < targets.length; i += YOUTUBE_VIDEOS_BATCH_SIZE) {
		const chunk = targets.slice(i, i + YOUTUBE_VIDEOS_BATCH_SIZE);
		const batch = await runYoutubePollBatch(env, chunk);
		totals.batches += batch.batches;
		totals.liveVideos += batch.liveVideos;
		totals.samplesWritten += batch.samplesWritten;
	}

	return totals;
}

async function bootstrapYoutubeLiveVideoIds(env: Env, db: D1Database, client: YoutubeDataApiClient, limit: number): Promise<void> {
	const missing = await listYoutubeTrackedMissingLiveVideoId(db, limit);
	for (const row of missing) {
		try {
			const videoId = await resolveYoutubeLiveVideoId(client, row.platformChannelId);
			if (videoId) {
				await setYoutubeLiveVideoId(db, row.channelRowId, videoId);
			}
		} catch (err) {
			ingestWarn('[youtube] live video id resolve failed', row.platformChannelId, err);
		}
	}
}

async function refreshYoutubeLiveVideoIdOnPollMiss(
	env: Env,
	db: D1Database,
	client: YoutubeDataApiClient,
	target: YoutubePollTarget,
): Promise<string | null> {
	try {
		const videoId = await resolveYoutubeLiveVideoId(client, target.platformChannelId);
		if (videoId) {
			await setYoutubeLiveVideoId(db, target.channelRowId, videoId);
			return videoId;
		}
	} catch (err) {
		ingestWarn('[youtube] poll-miss refresh failed', target.platformChannelId, err);
	}
	return null;
}

export async function runYoutubePollBatch(env: Env, targets: YoutubePollTarget[]): Promise<YoutubePollResult> {
	const db = requireDb(env);
	const client = new YoutubeDataApiClient(env);
	const minViewers = youtubeMinViewersFromEnv(env);
	const result: YoutubePollResult = {
		batches: targets.length > 0 ? 1 : 0,
		liveVideos: 0,
		samplesWritten: 0,
	};

	if (targets.length === 0) return result;

	const videoIds = targets.map((t) => t.liveVideoId);
	const targetByVideoId = new Map(targets.map((t) => [t.liveVideoId, t]));
	const videos = await client.getVideosByIds(videoIds);

	const liveVideoIds = new Set<string>();
	const endedChannelIds: string[] = [];
	const sampleInputs: YoutubeLiveSampleInput[] = [];

	for (const video of videos) {
		const target = targetByVideoId.get(video.id);
		if (!target) continue;

		if (youtubeStreamEnded(video) || !isYoutubeLive(video)) {
			const refreshed = await refreshYoutubeLiveVideoIdOnPollMiss(env, db, client, target);
			if (refreshed) {
				liveVideoIds.add(refreshed);
				continue;
			}
			endedChannelIds.push(target.channelRowId);
			continue;
		}

		result.liveVideos += 1;
		liveVideoIds.add(video.id);

		const viewers = parseYoutubeConcurrentViewers(video.liveStreamingDetails?.concurrentViewers);
		if (!isYoutubeConcurrentViewersKnown(video.liveStreamingDetails?.concurrentViewers) || viewers == null || viewers < minViewers) {
			continue;
		}

		sampleInputs.push({ channelId: target.channelRowId, video });
	}

	for (const target of targets) {
		if (liveVideoIds.has(target.liveVideoId)) continue;
		if (endedChannelIds.includes(target.channelRowId)) continue;

		const refreshed = await refreshYoutubeLiveVideoIdOnPollMiss(env, db, client, target);
		if (refreshed) {
			liveVideoIds.add(refreshed);
			continue;
		}
		endedChannelIds.push(target.channelRowId);
	}

	const archiveRows = await batchRecordYoutubeLiveSamples(db, sampleInputs, {
		env,
		scope: 'youtube:poll:samples',
	});
	result.samplesWritten = archiveRows.length;
	await archiveSampleBatch(env, archiveRows);

	if (endedChannelIds.length > 0) {
		const uniqueEnded = [...new Set(endedChannelIds)];
		await clearYoutubeLiveVideoIds(db, uniqueEnded, {
			env,
			scope: 'youtube:poll:clear_live_video_id',
		});
		const endedPlatformIds = uniqueEnded
			.map((id) => targets.find((t) => t.channelRowId === id)?.platformChannelId)
			.filter((id): id is string => Boolean(id));
		const now = new Date().toISOString();
		await closeOpenSessionsForPlatformChannelIds(db, PLATFORM_YOUTUBE, endedPlatformIds, now, {
			env,
			scope: 'youtube:poll:ended_close_sessions',
		});
	}

	const now = new Date().toISOString();
	const lastSeenStatements = targets.map((t) =>
		db
			.prepare(`UPDATE channels SET last_seen_at = ? WHERE platform_id = ? AND platform_channel_id = ?`)
			.bind(now, PLATFORM_YOUTUBE, t.platformChannelId),
	);
	await runD1Batches(db, lastSeenStatements, {
		env,
		scope: 'youtube:poll:last_seen',
	});

	return result;
}
