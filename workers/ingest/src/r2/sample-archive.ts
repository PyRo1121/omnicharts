/**
 * R2 cold sample archive — NDJSON batches (Parquet deferred).
 * Master switch: SAMPLE_ARCHIVE_ENABLED=1. Row gate: SAMPLE_ARCHIVE_MIN_ROWS (default 10).
 * Production wrangler bakes SAMPLE_ARCHIVE_ENABLED=0 — zero Class A puts until ops enable.
 * @see docs/23-paid-tier-zero-overage-playbook.md#r2-ndjson-archive
 * @see docs/11-cloudflare-deployment.md#r2-patterns
 */

import { PLATFORM_TWITCH } from '@omnicharts/domain';

/** Default row gate when SAMPLE_ARCHIVE_MIN_ROWS is unset — skips tiny sweep/poll batches. */
export const DEFAULT_SAMPLE_ARCHIVE_MIN_ROWS = 10;

export type SampleArchiveRow = {
	stream_session_id: string;
	sampled_at: string;
	viewer_count: number;
	platform?: string;
};

export type SampleArchiveSkipReason = 'disabled' | 'no_bucket' | 'below_threshold';

export type SampleArchiveResult = {
	archived: number;
	key?: string;
	skipped?: SampleArchiveSkipReason;
};

export function sampleArchiveObjectKey(
	row: SampleArchiveRow,
	partId = crypto.randomUUID()
): string {
	const day = row.sampled_at.slice(0, 10);
	const platform = row.platform ?? PLATFORM_TWITCH;
	return `samples/year=${day.slice(0, 4)}/month=${day.slice(5, 7)}/day=${day.slice(8, 10)}/platform=${platform}/part-${partId}.ndjson`;
}

export function sampleArchiveMinRowsFromEnv(env: Env): number {
	const raw = env.SAMPLE_ARCHIVE_MIN_ROWS?.trim();
	if (!raw) return DEFAULT_SAMPLE_ARCHIVE_MIN_ROWS;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 1) return DEFAULT_SAMPLE_ARCHIVE_MIN_ROWS;
	return n;
}

export function shouldArchiveSampleBatch(env: Env, rowCount: number): SampleArchiveSkipReason | null {
	if (env.SAMPLE_ARCHIVE_ENABLED !== '1') return 'disabled';
	if (!env.SAMPLES) return 'no_bucket';
	if (rowCount < sampleArchiveMinRowsFromEnv(env)) return 'below_threshold';
	return null;
}

export async function archiveSampleBatch(
	env: Env,
	rows: SampleArchiveRow[]
): Promise<SampleArchiveResult> {
	if (rows.length === 0) return { archived: 0 };

	const skip = shouldArchiveSampleBatch(env, rows.length);
	if (skip) return { archived: 0, skipped: skip };

	const bucket = env.SAMPLES!;
	const key = sampleArchiveObjectKey(rows[0]!);
	const body = rows.map((r) => JSON.stringify(r)).join('\n');
	await bucket.put(key, body, {
		httpMetadata: { contentType: 'application/x-ndjson' }
	});
	return { archived: rows.length, key };
}
