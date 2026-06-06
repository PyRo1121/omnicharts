import type { HelixStream } from './helix';
import { flushSampleArchivePage, ingestHelixStreamsBatch } from './ingest-stream';
import type { IngestRunOpts } from '../db/d1-meta';

export type StreamPageIngestStats = {
	streamsSeen: number;
	channelsIngested: number;
	duplicatesSkipped: number;
};

/** Ingest one Helix page; dedupe within the current cycle via `seenUserIds`. */
export async function ingestStreamPage(
	env: Env,
	streams: HelixStream[],
	minViewers: number,
	seenUserIds: Set<string>,
	stats: StreamPageIngestStats,
	runOpts?: IngestRunOpts,
): Promise<{ pageMaxViewers: number }> {
	let pageMaxViewers = 0;
	const toIngest: HelixStream[] = [];

	for (const stream of streams) {
		if (stream.viewer_count > pageMaxViewers) pageMaxViewers = stream.viewer_count;
		if (seenUserIds.has(stream.user_id)) {
			stats.duplicatesSkipped++;
			continue;
		}
		seenUserIds.add(stream.user_id);
		stats.streamsSeen++;
		toIngest.push(stream);
		stats.channelsIngested++;
	}

	const archiveRows = await ingestHelixStreamsBatch(env, toIngest, minViewers, runOpts);
	await flushSampleArchivePage(env, archiveRows);

	return { pageMaxViewers };
}
