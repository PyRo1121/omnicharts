import { PLATFORM_TWITCH, type PlatformId } from '@omnicharts/domain';
import { chunkArray, D1_BATCH_MAX_STATEMENTS, runD1Batches } from './d1-batch';
import type { D1LogOpts } from './d1-meta';

export type StaleSessionClose = {
	channelId: string;
	platformStreamId: string;
};

/** Open session row loaded once per poll batch for session UPDATE elision. */
export type OpenSessionRow = {
	id: string;
	platform_stream_id: string;
	started_at: string;
	title: string;
	game_category_id: string | null;
	language: string | null;
	tags_json: string | null;
	thumbnail_url: string | null;
	stream_type: string | null;
};

export type SessionPersistFields = Pick<
	OpenSessionRow,
	'title' | 'game_category_id' | 'language' | 'tags_json' | 'thumbnail_url' | 'stream_type'
>;

export function sessionPersistFieldsUnchanged(existing: SessionPersistFields, next: SessionPersistFields): boolean {
	return (
		existing.title === next.title &&
		(existing.game_category_id ?? null) === (next.game_category_id ?? null) &&
		(existing.language ?? null) === (next.language ?? null) &&
		(existing.tags_json ?? null) === (next.tags_json ?? null) &&
		(existing.thumbnail_url ?? null) === (next.thumbnail_url ?? null) &&
		(existing.stream_type ?? null) === (next.stream_type ?? null)
	);
}

/** Latest open session per channel (by started_at) including persist fields for diff. */
export async function fetchLatestOpenSessionsByChannelId(db: D1Database, channelIds: string[]): Promise<Map<string, OpenSessionRow>> {
	const latest = new Map<string, OpenSessionRow & { channel_id: string }>();
	if (channelIds.length === 0) return latest;

	for (const batch of chunkArray(channelIds, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = batch.map(() => '?').join(', ');
		const { results } = await db
			.prepare(
				`SELECT id, channel_id, platform_stream_id, started_at, title, game_category_id,
                language, tags_json, thumbnail_url, stream_type
         FROM stream_sessions
         WHERE channel_id IN (${placeholders}) AND ended_at IS NULL`,
			)
			.bind(...batch)
			.all<OpenSessionRow & { channel_id: string }>();

		for (const row of results ?? []) {
			const prev = latest.get(row.channel_id);
			if (!prev || row.started_at > prev.started_at) {
				latest.set(row.channel_id, row);
			}
		}
	}

	const out = new Map<string, OpenSessionRow>();
	for (const [channelId, row] of latest) {
		out.set(channelId, {
			id: row.id,
			platform_stream_id: row.platform_stream_id,
			started_at: row.started_at,
			title: row.title,
			game_category_id: row.game_category_id,
			language: row.language,
			tags_json: row.tags_json,
			thumbnail_url: row.thumbnail_url,
			stream_type: row.stream_type,
		});
	}
	return out;
}

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
