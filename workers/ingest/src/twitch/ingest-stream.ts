import type { HelixStream } from './helix';
import {
	batchRecordLiveSamples,
	batchUpsertChannelsFromStreams,
	batchUpsertGameCategories,
	type LiveSampleInput
} from '../db/twitch';
import { archiveSampleBatch, type SampleArchiveRow } from '../r2/sample-archive';
import { requireDb } from '../worker-bindings';

/** Batch upsert metadata + viewer samples for one Helix page or poll shard. */
export async function ingestHelixStreamsBatch(
	env: Env,
	streams: HelixStream[],
	minViewers: number
): Promise<SampleArchiveRow[]> {
	if (streams.length === 0) return [];

	const db = requireDb(env);
	const games = streams
		.map((s) => {
			const gameId = s.game_id?.trim();
			if (!gameId) return null;
			return { id: gameId, name: s.game_name?.trim() || 'Unknown' };
		})
		.filter((g): g is { id: string; name: string } => g != null);

	const gameMap = await batchUpsertGameCategories(db, games);
	const channelMap = await batchUpsertChannelsFromStreams(
		db,
		streams,
		{ minViewers, promoteToTracked: true },
		{ env, scope: 'ingest:channels' }
	);

	const sampleInputs: LiveSampleInput[] = [];
	for (const stream of streams) {
		if (stream.viewer_count < minViewers) continue;
		const channelId = channelMap.get(stream.user_id);
		if (!channelId) continue;
		const gameId = stream.game_id?.trim();
		sampleInputs.push({
			channelId,
			stream,
			gameCategoryId: gameId ? (gameMap.get(gameId) ?? null) : null
		});
	}

	return batchRecordLiveSamples(db, sampleInputs, { env, scope: 'ingest:samples' });
}

/** Upsert channel/game metadata and optionally record a viewer sample. */
export async function ingestHelixStream(
	env: Env,
	stream: HelixStream,
	minViewers: number
): Promise<SampleArchiveRow | undefined> {
	const rows = await ingestHelixStreamsBatch(env, [stream], minViewers);
	return rows[0];
}

/** Archive rows from a sweep/game-pass page in one R2 object when enabled. */
export async function flushSampleArchivePage(
	env: Env,
	rows: SampleArchiveRow[]
): Promise<void> {
	if (rows.length === 0) return;
	await archiveSampleBatch(env, rows);
}
