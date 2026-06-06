import { PLATFORM_TWITCH, type PlatformId } from '@omnicharts/domain';
import { chunkArray, D1_BATCH_MAX_STATEMENTS, runD1Batches } from './d1-batch';
import type { D1LogOpts } from './d1-meta';

export type StaleSessionClose = {
	channelId: string;
	platformStreamId: string;
};

/** Close open sessions whose Helix stream id no longer matches (batched, ≤50 per `batch()`). */
export async function batchCloseStaleOpenSessionsForChannels(
	db: D1Database,
	closes: StaleSessionClose[],
	endedAt: string,
	batchOpts?: D1LogOpts,
): Promise<void> {
	if (closes.length === 0) return;

	const statements = closes.map(({ channelId, platformStreamId }) =>
		db
			.prepare(
				`UPDATE stream_sessions SET ended_at = ?
     WHERE channel_id = ? AND ended_at IS NULL AND platform_stream_id != ?`,
			)
			.bind(endedAt, channelId, platformStreamId),
	);

	await runD1Batches(db, statements, batchOpts);
}

/** Close open stream_sessions for channels not seen live in a poll/reconcile batch. */
export async function closeOpenSessionsForPlatformChannelIds(
	db: D1Database,
	platformId: PlatformId,
	platformChannelIds: string[],
	endedAt: string,
	batchOpts?: D1LogOpts,
): Promise<void> {
	if (platformChannelIds.length === 0) return;

	const statements: D1PreparedStatement[] = [];
	for (const chunk of chunkArray(platformChannelIds, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = chunk.map(() => '?').join(', ');
		statements.push(
			db
				.prepare(
					`UPDATE stream_sessions SET ended_at = ?
         WHERE ended_at IS NULL AND channel_id IN (
           SELECT id FROM channels WHERE platform_id = ? AND platform_channel_id IN (${placeholders})
         )`,
				)
				.bind(endedAt, platformId, ...chunk),
		);
	}

	await runD1Batches(db, statements, batchOpts);
}

/** @deprecated Prefer `closeOpenSessionsForPlatformChannelIds(db, PLATFORM_TWITCH, …)`. */
export async function closeOpenSessionsForTwitchPlatformChannelIds(
	db: D1Database,
	platformChannelIds: string[],
	endedAt: string,
	batchOpts?: D1LogOpts,
): Promise<void> {
	return closeOpenSessionsForPlatformChannelIds(db, PLATFORM_TWITCH, platformChannelIds, endedAt, batchOpts);
}

/** Close other open sessions when Helix stream id changes (mirrors EventSub stream.online). */
export async function closeStaleOpenSessionsForChannel(
	db: D1Database,
	channelId: string,
	platformStreamId: string,
	endedAt: string,
	batchOpts?: D1LogOpts,
): Promise<void> {
	await batchCloseStaleOpenSessionsForChannels(db, [{ channelId, platformStreamId }], endedAt, batchOpts);
}
