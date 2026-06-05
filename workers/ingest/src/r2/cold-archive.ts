/**
 * R2 cold archive — Parquet batches for pruned D1 rows (Phase 4.3).
 * Master switch: COLD_ARCHIVE_ENABLED=1. Production default off — docs/23.
 * @see docs/06-storage-and-rollup-design.md
 * @see docs/11-cloudflare-deployment.md#r2-patterns
 */

import { parquetWriteBuffer } from 'hyparquet-writer';

export type ColdArchiveKind =
	| 'viewer_samples'
	| 'channel_daily_rollups'
	| 'game_daily_rollups';

export type ColdArchiveSkipReason = 'disabled' | 'no_bucket' | 'empty';

export type ColdArchivePutResult = {
	archived: number;
	key?: string;
	skipped?: ColdArchiveSkipReason;
};

export type ViewerSampleArchiveRow = {
	stream_session_id: string;
	sampled_at: string;
	viewer_count: number;
	channel_id: string;
	platform_id: string;
};

export type ChannelRollupArchiveRow = {
	channel_id: string;
	date: string;
	hours_watched: number;
	average_viewers: number;
	peak_viewers: number;
	airtime_minutes: number;
	stream_count: number;
	followers_delta: number | null;
};

export type GameRollupArchiveRow = {
	game_category_id: string;
	date: string;
	hours_watched: number;
	average_viewers: number;
	peak_viewers: number;
	airtime_minutes: number;
	live_channels: number;
};

export type ColdArchiveRow =
	| ViewerSampleArchiveRow
	| ChannelRollupArchiveRow
	| GameRollupArchiveRow;

const KIND_PATH: Record<ColdArchiveKind, string> = {
	viewer_samples: 'samples',
	channel_daily_rollups: 'rollups',
	game_daily_rollups: 'rollups'
};

const KIND_SUFFIX: Record<ColdArchiveKind, string> = {
	viewer_samples: '',
	channel_daily_rollups: '/kind=channel_daily',
	game_daily_rollups: '/kind=game_daily'
};

export function coldArchiveObjectKey(
	kind: ColdArchiveKind,
	partitionDate: string,
	platform: string,
	partId: string
): string {
	const year = partitionDate.slice(0, 4);
	const month = partitionDate.slice(5, 7);
	const base = KIND_PATH[kind];
	const suffix = KIND_SUFFIX[kind];
	if (kind === 'viewer_samples') {
		const day = partitionDate.slice(8, 10);
		return `${base}/year=${year}/month=${month}/day=${day}/platform=${platform}/part-${partId}.parquet`;
	}
	return `${base}/year=${year}/month=${month}${suffix}/part-${partId}.parquet`;
}

export function shouldColdArchive(env: Env): ColdArchiveSkipReason | null {
	if (env.COLD_ARCHIVE_ENABLED !== '1') return 'disabled';
	if (!env.SAMPLES) return 'no_bucket';
	return null;
}

function partitionDateFromRows(kind: ColdArchiveKind, rows: ColdArchiveRow[]): string {
	if (rows.length === 0) return new Date().toISOString().slice(0, 10);
	if (kind === 'viewer_samples') {
		return (rows[0] as ViewerSampleArchiveRow).sampled_at.slice(0, 10);
	}
	return (rows[0] as ChannelRollupArchiveRow | GameRollupArchiveRow).date;
}

function platformFromSampleRows(rows: ViewerSampleArchiveRow[]): string {
	return rows[0]?.platform_id ?? 'unknown';
}

export function encodeRowsToParquet(kind: ColdArchiveKind, rows: ColdArchiveRow[]): ArrayBuffer {
	if (rows.length === 0) return new ArrayBuffer(0);

	if (kind === 'viewer_samples') {
		const sampleRows = rows as ViewerSampleArchiveRow[];
		return parquetWriteBuffer({
			codec: 'UNCOMPRESSED',
			columnData: [
				{ name: 'stream_session_id', data: sampleRows.map((r) => r.stream_session_id), type: 'STRING' },
				{ name: 'sampled_at', data: sampleRows.map((r) => r.sampled_at), type: 'STRING' },
				{ name: 'viewer_count', data: sampleRows.map((r) => r.viewer_count), type: 'INT32' },
				{ name: 'channel_id', data: sampleRows.map((r) => r.channel_id), type: 'STRING' },
				{ name: 'platform_id', data: sampleRows.map((r) => r.platform_id), type: 'STRING' }
			]
		});
	}

	if (kind === 'channel_daily_rollups') {
		const rollupRows = rows as ChannelRollupArchiveRow[];
		return parquetWriteBuffer({
			codec: 'UNCOMPRESSED',
			columnData: [
				{ name: 'channel_id', data: rollupRows.map((r) => r.channel_id), type: 'STRING' },
				{ name: 'date', data: rollupRows.map((r) => r.date), type: 'STRING' },
				{ name: 'hours_watched', data: rollupRows.map((r) => r.hours_watched), type: 'DOUBLE' },
				{ name: 'average_viewers', data: rollupRows.map((r) => r.average_viewers), type: 'DOUBLE' },
				{ name: 'peak_viewers', data: rollupRows.map((r) => r.peak_viewers), type: 'INT32' },
				{ name: 'airtime_minutes', data: rollupRows.map((r) => r.airtime_minutes), type: 'INT32' },
				{ name: 'stream_count', data: rollupRows.map((r) => r.stream_count), type: 'INT32' },
				{
					name: 'followers_delta',
					data: rollupRows.map((r) => r.followers_delta),
					type: 'INT32',
					nullable: true
				}
			]
		});
	}

	const gameRows = rows as GameRollupArchiveRow[];
	return parquetWriteBuffer({
		codec: 'UNCOMPRESSED',
		columnData: [
			{ name: 'game_category_id', data: gameRows.map((r) => r.game_category_id), type: 'STRING' },
			{ name: 'date', data: gameRows.map((r) => r.date), type: 'STRING' },
			{ name: 'hours_watched', data: gameRows.map((r) => r.hours_watched), type: 'DOUBLE' },
			{ name: 'average_viewers', data: gameRows.map((r) => r.average_viewers), type: 'DOUBLE' },
			{ name: 'peak_viewers', data: gameRows.map((r) => r.peak_viewers), type: 'INT32' },
			{ name: 'airtime_minutes', data: gameRows.map((r) => r.airtime_minutes), type: 'INT32' },
			{ name: 'live_channels', data: gameRows.map((r) => r.live_channels), type: 'INT32' }
		]
	});
}

export async function putColdArchiveParquet(
	env: Env,
	kind: ColdArchiveKind,
	partitionDate: string,
	platform: string,
	body: ArrayBuffer | Uint8Array
): Promise<ColdArchivePutResult> {
	const byteLength = body.byteLength;
	if (byteLength === 0) return { archived: 0, skipped: 'empty' };

	const skip = shouldColdArchive(env);
	if (skip) return { archived: 0, skipped: skip };

	const bucket = env.SAMPLES!;
	const key = coldArchiveObjectKey(kind, partitionDate, platform, crypto.randomUUID());
	await bucket.put(key, body, {
		httpMetadata: { contentType: 'application/vnd.apache.parquet' }
	});
	return { archived: byteLength, key };
}

export async function archiveRowsToColdStorage(
	env: Env,
	kind: ColdArchiveKind,
	rows: ColdArchiveRow[]
): Promise<ColdArchivePutResult> {
	if (rows.length === 0) return { archived: 0, skipped: 'empty' };

	const skip = shouldColdArchive(env);
	if (skip) return { archived: 0, skipped: skip };

	const partitionDate = partitionDateFromRows(kind, rows);
	const platform =
		kind === 'viewer_samples' ? platformFromSampleRows(rows as ViewerSampleArchiveRow[]) : 'rollup';
	const body = encodeRowsToParquet(kind, rows);
	return putColdArchiveParquet(env, kind, partitionDate, platform, body);
}
