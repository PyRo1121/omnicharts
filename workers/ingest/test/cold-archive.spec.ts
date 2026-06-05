import { describe, it, expect, vi } from 'vitest';
import {
	coldArchiveObjectKey,
	encodeRowsToParquet,
	putColdArchiveParquet,
	shouldColdArchive,
	type ColdArchiveKind
} from '../src/r2/cold-archive';

describe('coldArchiveObjectKey', () => {
	const cases: [ColdArchiveKind, string, string][] = [
		[
			'viewer_samples',
			'2026-03-15',
			'samples/year=2026/month=03/day=15/platform=twitch/part-test.parquet'
		],
		[
			'channel_daily_rollups',
			'2026-03-15',
			'rollups/year=2026/month=03/kind=channel_daily/part-test.parquet'
		],
		[
			'game_daily_rollups',
			'2026-03-15',
			'rollups/year=2026/month=03/kind=game_daily/part-test.parquet'
		]
	];

	it.each(cases)('builds hive path for %s', (kind, partitionDate, expected) => {
		expect(coldArchiveObjectKey(kind, partitionDate, 'twitch', 'test')).toBe(expected);
	});
});

describe('shouldColdArchive', () => {
	it('blocks when disabled or bucket missing', () => {
		expect(shouldColdArchive({} as Env)).toBe('disabled');
		expect(shouldColdArchive({ COLD_ARCHIVE_ENABLED: '0', SAMPLES: {} } as Env)).toBe('disabled');
		expect(shouldColdArchive({ COLD_ARCHIVE_ENABLED: '1' } as Env)).toBe('no_bucket');
	});

	it('allows when enabled and bucket bound', () => {
		expect(shouldColdArchive({ COLD_ARCHIVE_ENABLED: '1', SAMPLES: {} } as Env)).toBeNull();
	});
});

describe('encodeRowsToParquet', () => {
	it('returns PAR1 bytes for sample rows', () => {
		const buf = encodeRowsToParquet('viewer_samples', [
			{
				stream_session_id: 'sess-1',
				sampled_at: '2026-03-01T12:00:00.000Z',
				viewer_count: 42,
				channel_id: 'ch-1',
				platform_id: 'twitch'
			}
		]);
		expect(buf.byteLength).toBeGreaterThan(0);
		expect(String.fromCharCode(...new Uint8Array(buf).slice(0, 4))).toBe('PAR1');
	});

	it('returns PAR1 bytes for channel and game rollup rows', () => {
		const channelBuf = encodeRowsToParquet('channel_daily_rollups', [
			{
				channel_id: 'ch-1',
				date: '2026-03-01',
				hours_watched: 1.5,
				average_viewers: 10,
				peak_viewers: 20,
				airtime_minutes: 60,
				stream_count: 1,
				followers_delta: null
			}
		]);
		const gameBuf = encodeRowsToParquet('game_daily_rollups', [
			{
				game_category_id: 'g-1',
				date: '2026-03-01',
				hours_watched: 2,
				average_viewers: 15,
				peak_viewers: 30,
				airtime_minutes: 90,
				live_channels: 4
			}
		]);
		expect(String.fromCharCode(...new Uint8Array(channelBuf).slice(0, 4))).toBe('PAR1');
		expect(String.fromCharCode(...new Uint8Array(gameBuf).slice(0, 4))).toBe('PAR1');
	});

	it('returns empty buffer for zero rows', () => {
		expect(encodeRowsToParquet('viewer_samples', []).byteLength).toBe(0);
	});
});

describe('putColdArchiveParquet', () => {
	it('no-ops when disabled', async () => {
		const put = vi.fn();
		const result = await putColdArchiveParquet(
			{ COLD_ARCHIVE_ENABLED: '0', SAMPLES: { put } } as unknown as Env,
			'viewer_samples',
			'2026-03-01',
			'twitch',
			new Uint8Array([1, 2, 3])
		);
		expect(result).toEqual({ archived: 0, skipped: 'disabled' });
		expect(put).not.toHaveBeenCalled();
	});

	it('no-ops on empty parquet body', async () => {
		const put = vi.fn();
		expect(
			await putColdArchiveParquet(
				{ COLD_ARCHIVE_ENABLED: '1', SAMPLES: { put } } as unknown as Env,
				'viewer_samples',
				'2026-03-01',
				'twitch',
				new Uint8Array()
			)
		).toEqual({ archived: 0, skipped: 'empty' });
		expect(put).not.toHaveBeenCalled();
	});

	it('writes parquet to R2 when enabled', async () => {
		const put = vi.fn().mockResolvedValue(undefined);
		const body = new Uint8Array([0x50, 0x41, 0x52, 0x31]);
		const result = await putColdArchiveParquet(
			{ COLD_ARCHIVE_ENABLED: '1', SAMPLES: { put } } as unknown as Env,
			'viewer_samples',
			'2026-03-01',
			'twitch',
			body
		);
		expect(result.archived).toBe(4);
		expect(result.key).toMatch(
			/^samples\/year=2026\/month=03\/day=01\/platform=twitch\/part-.+\.parquet$/
		);
		expect(put).toHaveBeenCalledOnce();
		const [key, value, opts] = put.mock.calls[0] as [string, Uint8Array, { httpMetadata: object }];
		expect(key).toBe(result.key);
		expect(value).toBe(body);
		expect(opts.httpMetadata).toEqual({ contentType: 'application/vnd.apache.parquet' });
	});
});

describe('archiveRowsToColdStorage', () => {
	it('delegates to encode and put when enabled', async () => {
		const put = vi.fn().mockResolvedValue(undefined);
		const rows = [
			{
				stream_session_id: 'sess-1',
				sampled_at: '2026-03-01T12:00:00.000Z',
				viewer_count: 42,
				channel_id: 'ch-1',
				platform_id: 'twitch'
			}
		];
		const { archiveRowsToColdStorage } = await import('../src/r2/cold-archive');
		const result = await archiveRowsToColdStorage(
			{ COLD_ARCHIVE_ENABLED: '1', SAMPLES: { put } } as unknown as Env,
			'viewer_samples',
			rows
		);
		expect(result.archived).toBeGreaterThan(0);
		expect(result.key).toMatch(/\.parquet$/);
		expect(put).toHaveBeenCalledOnce();
	});

	it('skips when disabled or empty', async () => {
		const { archiveRowsToColdStorage } = await import('../src/r2/cold-archive');
		expect(await archiveRowsToColdStorage({} as Env, 'viewer_samples', [])).toEqual({
			archived: 0,
			skipped: 'empty'
		});
		expect(
			await archiveRowsToColdStorage({ COLD_ARCHIVE_ENABLED: '0', SAMPLES: {} } as Env, 'viewer_samples', [
				{
					stream_session_id: 's',
					sampled_at: '2026-03-01T00:00:00.000Z',
					viewer_count: 1,
					channel_id: 'c',
					platform_id: 'twitch'
				}
			])
		).toEqual({ archived: 0, skipped: 'disabled' });
		expect(
			await archiveRowsToColdStorage({ COLD_ARCHIVE_ENABLED: '1' } as Env, 'viewer_samples', [
				{
					stream_session_id: 's',
					sampled_at: '2026-03-01T00:00:00.000Z',
					viewer_count: 1,
					channel_id: 'c',
					platform_id: 'twitch'
				}
			])
		).toEqual({ archived: 0, skipped: 'no_bucket' });
	});
});
