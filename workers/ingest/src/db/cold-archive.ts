/**
 * Archive pruned D1 rows to R2 Parquet before delete — Phase 4.3.
 * Called from rollup_daily after rollups complete; keeps hot window lean.
 */

import {
	archiveRowsToColdStorage,
	shouldColdArchive,
	type ChannelRollupArchiveRow,
	type GameRollupArchiveRow,
	type ViewerSampleArchiveRow
} from '../r2/cold-archive';
import {
	DAILY_ROLLUP_DELETE_BATCH_SIZE,
	dailyRollupRetentionCutoffDate
} from './prune-rollups';
import {
	VIEWER_SAMPLE_DELETE_BATCH_SIZE,
	viewerSampleRetentionCutoffIso
} from './prune-samples';
import { pruneDailyRollupsOlderThanRetention } from './prune-rollups';
import { pruneViewerSamplesOlderThanRetention } from './prune-samples';

export type RetentionWithColdArchiveStats = {
	viewerSamplesPruned: number;
	channelRollupsPruned: number;
	gameRollupsPruned: number;
};

type SampleRowWithId = ViewerSampleArchiveRow & { id: number };

async function fetchPrunableViewerSamples(
	db: D1Database,
	cutoff: string,
	limit: number
): Promise<SampleRowWithId[]> {
	const { results } = await db
		.prepare(
			`SELECT vs.id, vs.stream_session_id, vs.sampled_at, vs.viewer_count,
              ss.channel_id, c.platform_id
       FROM viewer_samples vs
       INNER JOIN stream_sessions ss ON ss.id = vs.stream_session_id
       INNER JOIN channels c ON c.id = ss.channel_id
       WHERE vs.sampled_at < ?
       ORDER BY vs.id ASC
       LIMIT ?`
		)
		.bind(cutoff, limit)
		.all<SampleRowWithId>();

	return results ?? [];
}

async function deleteViewerSamplesById(db: D1Database, ids: number[]): Promise<number> {
	if (ids.length === 0) return 0;
	const result = await db
		.prepare(`DELETE FROM viewer_samples WHERE id IN (SELECT value FROM json_each(?))`)
		.bind(JSON.stringify(ids))
		.run();
	return result.meta?.changes ?? 0;
}

async function archiveAndPruneViewerSamples(
	db: D1Database,
	env: Env,
	now: Date
): Promise<number> {
	const cutoff = viewerSampleRetentionCutoffIso(now);
	let totalDeleted = 0;

	for (;;) {
		const rows = await fetchPrunableViewerSamples(db, cutoff, VIEWER_SAMPLE_DELETE_BATCH_SIZE);
		if (rows.length === 0) break;

		await archiveRowsToColdStorage(env, 'viewer_samples', rows);

		const deleted = await deleteViewerSamplesById(
			db,
			rows.map((r) => r.id)
		);
		totalDeleted += deleted;
		if (rows.length < VIEWER_SAMPLE_DELETE_BATCH_SIZE) break;
	}

	return totalDeleted;
}

async function fetchPrunableChannelRollups(
	db: D1Database,
	cutoff: string,
	limit: number
): Promise<ChannelRollupArchiveRow[]> {
	const { results } = await db
		.prepare(
			`SELECT channel_id, date, hours_watched, average_viewers, peak_viewers,
              airtime_minutes, stream_count, followers_delta
       FROM channel_daily_rollups
       WHERE date < ?
       ORDER BY date ASC, channel_id ASC
       LIMIT ?`
		)
		.bind(cutoff, limit)
		.all<ChannelRollupArchiveRow>();

	return results ?? [];
}

async function deleteChannelRollupsBatch(
	db: D1Database,
	rows: ChannelRollupArchiveRow[]
): Promise<number> {
	if (rows.length === 0) return 0;
	let totalDeleted = 0;
	for (const row of rows) {
		const result = await db
			.prepare(`DELETE FROM channel_daily_rollups WHERE channel_id = ? AND date = ?`)
			.bind(row.channel_id, row.date)
			.run();
		totalDeleted += result.meta?.changes ?? 0;
	}
	return totalDeleted;
}

async function archiveAndPruneChannelRollups(
	db: D1Database,
	env: Env,
	now: Date
): Promise<number> {
	const cutoff = dailyRollupRetentionCutoffDate(now);
	let totalDeleted = 0;

	for (;;) {
		const rows = await fetchPrunableChannelRollups(db, cutoff, DAILY_ROLLUP_DELETE_BATCH_SIZE);
		if (rows.length === 0) break;

		await archiveRowsToColdStorage(env, 'channel_daily_rollups', rows);

		totalDeleted += await deleteChannelRollupsBatch(db, rows);
		if (rows.length < DAILY_ROLLUP_DELETE_BATCH_SIZE) break;
	}

	return totalDeleted;
}

async function fetchPrunableGameRollups(
	db: D1Database,
	cutoff: string,
	limit: number
): Promise<GameRollupArchiveRow[]> {
	const { results } = await db
		.prepare(
			`SELECT game_category_id, date, hours_watched, average_viewers, peak_viewers,
              airtime_minutes, live_channels
       FROM game_daily_rollups
       WHERE date < ?
       ORDER BY date ASC, game_category_id ASC
       LIMIT ?`
		)
		.bind(cutoff, limit)
		.all<GameRollupArchiveRow>();

	return results ?? [];
}

async function deleteGameRollupsBatch(db: D1Database, rows: GameRollupArchiveRow[]): Promise<number> {
	if (rows.length === 0) return 0;
	let totalDeleted = 0;
	for (const row of rows) {
		const result = await db
			.prepare(`DELETE FROM game_daily_rollups WHERE game_category_id = ? AND date = ?`)
			.bind(row.game_category_id, row.date)
			.run();
		totalDeleted += result.meta?.changes ?? 0;
	}
	return totalDeleted;
}

async function archiveAndPruneGameRollups(
	db: D1Database,
	env: Env,
	now: Date
): Promise<number> {
	const cutoff = dailyRollupRetentionCutoffDate(now);
	let totalDeleted = 0;

	for (;;) {
		const rows = await fetchPrunableGameRollups(db, cutoff, DAILY_ROLLUP_DELETE_BATCH_SIZE);
		if (rows.length === 0) break;

		await archiveRowsToColdStorage(env, 'game_daily_rollups', rows);

		totalDeleted += await deleteGameRollupsBatch(db, rows);
		if (rows.length < DAILY_ROLLUP_DELETE_BATCH_SIZE) break;
	}

	return totalDeleted;
}

/**
 * Prune hot-window tables; archive to R2 Parquet first when COLD_ARCHIVE_ENABLED=1.
 */
export async function runRetentionWithColdArchive(
	env: Env,
	now = new Date()
): Promise<RetentionWithColdArchiveStats> {
	const db = env.DB;
	if (!db) {
		return { viewerSamplesPruned: 0, channelRollupsPruned: 0, gameRollupsPruned: 0 };
	}

	if (shouldColdArchive(env) === null) {
		const channelRollupsPruned = await archiveAndPruneChannelRollups(db, env, now);
		const gameRollupsPruned = await archiveAndPruneGameRollups(db, env, now);
		const viewerSamplesPruned = await archiveAndPruneViewerSamples(db, env, now);
		return { viewerSamplesPruned, channelRollupsPruned, gameRollupsPruned };
	}

	const rollupResult = await pruneDailyRollupsOlderThanRetention(db, now);
	const viewerSamplesPruned = await pruneViewerSamplesOlderThanRetention(db, now);
	return {
		viewerSamplesPruned,
		channelRollupsPruned: rollupResult.channelRows,
		gameRollupsPruned: rollupResult.gameRows
	};
}
