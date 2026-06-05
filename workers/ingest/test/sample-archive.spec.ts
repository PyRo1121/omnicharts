import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { testEnv } from './helpers';
import {
	archiveSampleBatch,
	DEFAULT_SAMPLE_ARCHIVE_MIN_ROWS,
	sampleArchiveMinRowsFromEnv,
	sampleArchiveObjectKey,
	shouldArchiveSampleBatch,
	type SampleArchiveRow,
} from '../src/r2/sample-archive';

function samplesBucket(put: R2Bucket['put']): R2Bucket {
	const stub: R2Bucket = {
		head: async () => null,
		get: async () => null,
		put,
		createMultipartUpload: async () => {
			throw new Error('unexpected createMultipartUpload');
		},
		resumeMultipartUpload: () => {
			throw new Error('unexpected resumeMultipartUpload');
		},
		delete: async () => {},
		list: async () => ({ objects: [], delimitedPrefixes: [], truncated: false }),
	};
	return stub;
}

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
		expect(sampleArchiveMinRowsFromEnv(testEnv())).toBe(DEFAULT_SAMPLE_ARCHIVE_MIN_ROWS);
		expect(sampleArchiveMinRowsFromEnv(testEnv({ SAMPLE_ARCHIVE_MIN_ROWS: '' }))).toBe(10);
		expect(sampleArchiveMinRowsFromEnv(testEnv({ SAMPLE_ARCHIVE_MIN_ROWS: '0' }))).toBe(10);
		expect(sampleArchiveMinRowsFromEnv(testEnv({ SAMPLE_ARCHIVE_MIN_ROWS: 'nope' }))).toBe(10);
	});

	it('parses positive integer from env', () => {
		expect(sampleArchiveMinRowsFromEnv(testEnv({ SAMPLE_ARCHIVE_MIN_ROWS: '25' }))).toBe(25);
	});
});

describe('shouldArchiveSampleBatch', () => {
	it('blocks when disabled, missing bucket, or below threshold', () => {
		expect(shouldArchiveSampleBatch(testEnv(), 100)).toBe('disabled');
		expect(shouldArchiveSampleBatch(testEnv({ SAMPLE_ARCHIVE_ENABLED: '0' }), 100)).toBe('disabled');
		expect(shouldArchiveSampleBatch(testEnv({ SAMPLE_ARCHIVE_ENABLED: '1' }), 100)).toBe('no_bucket');
		expect(
			shouldArchiveSampleBatch(
				testEnv({ SAMPLE_ARCHIVE_ENABLED: '1', SAMPLE_ARCHIVE_MIN_ROWS: '10', SAMPLES: samplesBucket(vi.fn()) }),
				9,
			),
		).toBe('below_threshold');
	});

	it('allows when enabled, bucket bound, and rows meet threshold', () => {
		expect(
			shouldArchiveSampleBatch(
				testEnv({ SAMPLE_ARCHIVE_ENABLED: '1', SAMPLE_ARCHIVE_MIN_ROWS: '10', SAMPLES: samplesBucket(vi.fn()) }),
				10,
			),
		).toBeNull();
	});
});

describe('archiveSampleBatch', () => {
	it('no-ops when empty', async () => {
		expect(await archiveSampleBatch(testEnv(), [])).toEqual({ archived: 0 });
	});

	it('no-ops when disabled', async () => {
		const put = vi.fn();
		expect(await archiveSampleBatch(testEnv({ SAMPLE_ARCHIVE_ENABLED: '0', SAMPLES: samplesBucket(put) }), rows(20))).toEqual({
			archived: 0,
			skipped: 'disabled',
		});
		expect(put).not.toHaveBeenCalled();
	});

	it('skips put when below SAMPLE_ARCHIVE_MIN_ROWS', async () => {
		const put = vi.fn();
		const env = testEnv({
			SAMPLE_ARCHIVE_ENABLED: '1',
			SAMPLE_ARCHIVE_MIN_ROWS: '10',
			SAMPLES: samplesBucket(put),
		});

		expect(await archiveSampleBatch(env, rows(9))).toEqual({ archived: 0, skipped: 'below_threshold' });
		expect(put).not.toHaveBeenCalled();
	});

	it('writes NDJSON to R2 when enabled and at threshold', async () => {
		const put: Mock<R2Bucket['put']> = vi.fn().mockResolvedValue(null);
		const env = testEnv({
			SAMPLE_ARCHIVE_ENABLED: '1',
			SAMPLE_ARCHIVE_MIN_ROWS: '2',
			SAMPLES: samplesBucket(put),
		});

		const result = await archiveSampleBatch(env, rows(2));

		expect(result.archived).toBe(2);
		expect(result.key).toMatch(/^samples\/year=2026\/month=06\/day=03\/platform=twitch\/part-.+\.ndjson$/);
		expect(put).toHaveBeenCalledOnce();
		const firstCall = put.mock.calls[0];
		expect(firstCall?.[0]).toBe(result.key);
		const body = firstCall?.[1];
		if (typeof body !== 'string') throw new Error('expected string body');
		expect(body.split('\n')).toHaveLength(2);
		expect(firstCall?.[2]).toEqual({ httpMetadata: { contentType: 'application/x-ndjson' } });
	});
});
