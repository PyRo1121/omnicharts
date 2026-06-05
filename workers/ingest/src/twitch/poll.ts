import { PLATFORM_TWITCH } from '@omnicharts/domain';
import { maxTrackedFromEnv, minViewersFromEnv, STREAMS_BATCH_SIZE } from './config';
import { TwitchHelixClient } from './helix';
import {
	batchRecordLiveSamples,
	batchUpsertChannelsFromStreams,
	batchUpsertGameCategories,
	listChannelIdsToPoll,
	type LiveSampleInput,
} from '../db/twitch';
import { runD1Batches } from '../db/d1-batch';
import { closeOpenSessionsForPlatformChannelIds } from '../db/session-lifecycle';
import type { IngestQueueMessage } from '../messages';
import { archiveSampleBatch } from '../r2/sample-archive';
import { requireDb, requireIngestQueue } from '../worker-bindings';

export type PollShardResult = {
	batches: number;
	liveStreams: number;
	samplesWritten: number;
};

/** Enqueue one catalog poll message (all Helix batches run in a single consumer). */
export async function enqueueTwitchPollShards(env: Env): Promise<number> {
	await requireIngestQueue(env).send({ body: { type: 'poll_twitch_catalog' } satisfies IngestQueueMessage });
	return 1;
}

/** Run tracked-catalog poll in-process (100 user_ids per Helix batch). */
export async function runTwitchCatalogPoll(env: Env): Promise<PollShardResult> {
	const db = requireDb(env);
	const limit = maxTrackedFromEnv(env);
	const userIds = await listChannelIdsToPoll(db, limit);
	const totals: PollShardResult = { batches: 0, liveStreams: 0, samplesWritten: 0 };

	for (let i = 0; i < userIds.length; i += STREAMS_BATCH_SIZE) {
		const chunk = userIds.slice(i, i + STREAMS_BATCH_SIZE);
		const batch = await runTwitchPollBatch(env, chunk);
		totals.batches += batch.batches;
		totals.liveStreams += batch.liveStreams;
		totals.samplesWritten += batch.samplesWritten;
	}

	return totals;
}

export async function runTwitchPollBatch(env: Env, userIds: string[]): Promise<PollShardResult> {
	const db = requireDb(env);
	const client = new TwitchHelixClient(env);
	const minViewers = minViewersFromEnv(env);
	const result: PollShardResult = {
		batches: 1,
		liveStreams: 0,
		samplesWritten: 0,
	};

	const liveStreams = await client.getStreamsByUserIds(userIds);
	result.liveStreams = liveStreams.length;

	const liveSet = new Set(liveStreams.map((s) => s.user_id));
	const games = liveStreams
		.map((s) => {
			const gameId = s.game_id?.trim();
			if (!gameId) return null;
			return { id: gameId, name: s.game_name?.trim() || 'Unknown' };
		})
		.filter((g): g is { id: string; name: string } => g != null);

	const gameMap = await batchUpsertGameCategories(db, games);
	const channelMap = await batchUpsertChannelsFromStreams(
		db,
		liveStreams,
		{ minViewers, promoteToTracked: true },
		{ env, scope: 'poll:channels' },
	);

	const sampleInputs: LiveSampleInput[] = [];
	for (const stream of liveStreams) {
		if (stream.viewer_count < minViewers) continue;
		const channelId = channelMap.get(stream.user_id);
		if (!channelId) continue;
		const gameId = stream.game_id?.trim();
		sampleInputs.push({
			channelId,
			stream,
			gameCategoryId: gameId ? (gameMap.get(gameId) ?? null) : null,
		});
	}

	const archiveRows = await batchRecordLiveSamples(db, sampleInputs, {
		env,
		scope: 'poll:samples',
	});
	result.samplesWritten = archiveRows.length;

	await archiveSampleBatch(env, archiveRows);

	// Touch last_seen for offline tracked channels in this batch (no sample)
	const now = new Date().toISOString();
	const offlineIds = userIds.filter((uid) => !liveSet.has(uid));
	const offlineStatements = offlineIds.map((uid) =>
		db.prepare(`UPDATE channels SET last_seen_at = ? WHERE platform_id = 'twitch' AND platform_channel_id = ?`).bind(now, uid),
	);
	await runD1Batches(db, offlineStatements, {
		env,
		scope: 'poll:offline_last_seen',
	});
	await closeOpenSessionsForPlatformChannelIds(db, PLATFORM_TWITCH, offlineIds, now, {
		env,
		scope: 'poll:offline_close_sessions',
	});

	return result;
}
