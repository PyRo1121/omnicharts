import { describe, it, expect, vi } from 'vitest';
import {
	archiveSampleBatch,
	DEFAULT_SAMPLE_ARCHIVE_MIN_ROWS,
	sampleArchiveMinRowsFromEnv,
	sampleArchiveObjectKey,
	shouldArchiveSampleBatch,
	type SampleArchiveRow,
} from '../src/r2/sample-archive';

const row: SampleArchiveRow = {
	stream_session_id: 'sess-1',
	sampled_at: '2026-06-03T12:00:00.000Z',
	viewer_count: 42,
	platform: 'twitch',
};

function rows(n: number): SampleArchiveRow[] {
	return Array.from({ length: n }, (_, i) => ({
		...row,
		stream_session_id: `sess-${i}`,
	}));
}

describe('sampleArchiveObjectKey', () => {
	it('uses hive path with platform and UTC day', () => {
		expect(sampleArchiveObjectKey(row, 'test-part')).toBe('samples/year=2026/month=06/day=03/platform=twitch/part-test-part.ndjson');
	});
});

describe('sampleArchiveMinRowsFromEnv', () => {
	it('defaults to 10 when unset or invalid', () => {
		expect(sampleArchiveMinRowsFromEnv({} as Env)).toBe(DEFAULT_SAMPLE_ARCHIVE_MIN_ROWS);
		expect(sampleArchiveMinRowsFromEnv({ SAMPLE_ARCHIVE_MIN_ROWS: '' } as Env)).toBe(10);
		expect(sampleArchiveMinRowsFromEnv({ SAMPLE_ARCHIVE_MIN_ROWS: '0' } as Env)).toBe(10);
		expect(sampleArchiveMinRowsFromEnv({ SAMPLE_ARCHIVE_MIN_ROWS: 'nope' } as Env)).toBe(10);
	});

	it('parses positive integer from env', () => {
		expect(sampleArchiveMinRowsFromEnv({ SAMPLE_ARCHIVE_MIN_ROWS: '25' } as Env)).toBe(25);
	});
});

describe('shouldArchiveSampleBatch', () => {
	it('blocks when disabled, missing bucket, or below threshold', () => {
		expect(shouldArchiveSampleBatch({} as Env, 100)).toBe('disabled');
		expect(shouldArchiveSampleBatch({ SAMPLE_ARCHIVE_ENABLED: '0', SAMPLES: {} } as Env, 100)).toBe('disabled');
		expect(shouldArchiveSampleBatch({ SAMPLE_ARCHIVE_ENABLED: '1' } as Env, 100)).toBe('no_bucket');
		expect(shouldArchiveSampleBatch({ SAMPLE_ARCHIVE_ENABLED: '1', SAMPLES: {}, SAMPLE_ARCHIVE_MIN_ROWS: '10' } as Env, 9)).toBe(
			'below_threshold',
		);
	});

	it('allows when enabled, bucket bound, and rows meet threshold', () => {
		expect(shouldArchiveSampleBatch({ SAMPLE_ARCHIVE_ENABLED: '1', SAMPLES: {}, SAMPLE_ARCHIVE_MIN_ROWS: '10' } as Env, 10)).toBeNull();
	});
});

describe('archiveSampleBatch', () => {
	it('no-ops when empty', async () => {
		expect(await archiveSampleBatch({} as Env, [])).toEqual({ archived: 0 });
	});

	it('no-ops when disabled', async () => {
		const put = vi.fn();
		expect(await archiveSampleBatch({ SAMPLE_ARCHIVE_ENABLED: '0', SAMPLES: { put } } as unknown as Env, rows(20))).toEqual({
			archived: 0,
			skipped: 'disabled',
		});
		expect(put).not.toHaveBeenCalled();
	});

	it('skips put when below SAMPLE_ARCHIVE_MIN_ROWS', async () => {
		const put = vi.fn();
		const env = {
			SAMPLE_ARCHIVE_ENABLED: '1',
			SAMPLE_ARCHIVE_MIN_ROWS: '10',
			SAMPLES: { put },
		} as unknown as Env;

		expect(await archiveSampleBatch(env, rows(9))).toEqual({ archived: 0, skipped: 'below_threshold' });
		expect(put).not.toHaveBeenCalled();
	});

	it('writes NDJSON to R2 when enabled and at threshold', async () => {
		const put = vi.fn().mockResolvedValue(undefined);
		const env = {
			SAMPLE_ARCHIVE_ENABLED: '1',
			SAMPLE_ARCHIVE_MIN_ROWS: '2',
			SAMPLES: { put },
		} as unknown as Env;

		const result = await archiveSampleBatch(env, rows(2));

		expect(result.archived).toBe(2);
		expect(result.key).toMatch(/^samples\/year=2026\/month=06\/day=03\/platform=twitch\/part-.+\.ndjson$/);
		expect(put).toHaveBeenCalledOnce();
		const [key, body, opts] = put.mock.calls[0] as [string, string, { httpMetadata: object }];
		expect(key).toBe(result.key);
		expect(body.split('\n')).toHaveLength(2);
		expect(opts.httpMetadata).toEqual({ contentType: 'application/x-ndjson' });
	});
});
