import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VIEWER_SAMPLE_DELETE_BATCH_SIZE } from '../src/db/prune-samples';
import { runRetentionWithColdArchive } from '../src/db/cold-archive';
import * as coldArchiveR2 from '../src/r2/cold-archive';

vi.mock('../src/r2/cold-archive', async (importOriginal) => {
	const actual = await importOriginal<typeof coldArchiveR2>();
	return {
		...actual,
		archiveRowsToColdStorage: vi.fn(async () => ({ archived: 100, key: 'samples/test.parquet' }))
	};
});

const NOW = new Date('2026-06-05T12:00:00.000Z');

describe('runRetentionWithColdArchive', () => {
	beforeEach(() => {
		vi.mocked(coldArchiveR2.archiveRowsToColdStorage).mockClear();
	});

	it('returns zeroes when DB binding missing', async () => {
		await expect(runRetentionWithColdArchive({} as Env, NOW)).resolves.toEqual({
			viewerSamplesPruned: 0,
			channelRollupsPruned: 0,
			gameRollupsPruned: 0
		});
	});

	it('deletes without R2 when cold archive disabled', async () => {
		let sampleDeletes = 0;
		const db = makeDb({
			sampleRows: [{ id: 1, stream_session_id: 's', sampled_at: '2026-05-01T00:00:00.000Z', viewer_count: 1, channel_id: 'c', platform_id: 'twitch' }],
			onSampleDelete: () => {
				sampleDeletes += 1;
				return 1;
			}
		});

		const stats = await runRetentionWithColdArchive({ DB: db } as Env, NOW);
		expect(stats.viewerSamplesPruned).toBe(1);
		expect(coldArchiveR2.archiveRowsToColdStorage).not.toHaveBeenCalled();
		expect(sampleDeletes).toBe(1);
	});

	it('archives samples to R2 before delete when enabled', async () => {
		const env = { DB: undefined as unknown as D1Database, COLD_ARCHIVE_ENABLED: '1', SAMPLES: { put: vi.fn() } } as unknown as Env;
		let deletedIds: number[] = [];
		const db = makeDb({
			sampleRows: [
				{
					id: 99,
					stream_session_id: 'sess-1',
					sampled_at: '2026-05-01T00:00:00.000Z',
					viewer_count: 10,
					channel_id: 'ch-1',
					platform_id: 'twitch'
				}
			],
			onSampleDelete: (ids: number[]) => {
				deletedIds = ids;
				return ids.length;
			}
		});

		env.DB = db;
		const stats = await runRetentionWithColdArchive(env, NOW);
		expect(stats.viewerSamplesPruned).toBe(1);
		expect(coldArchiveR2.archiveRowsToColdStorage).toHaveBeenCalled();
		expect(deletedIds).toEqual([99]);
	});

	it('archives and prunes channel and game rollups when enabled', async () => {
		const env = { DB: undefined as unknown as D1Database, COLD_ARCHIVE_ENABLED: '1', SAMPLES: {} } as unknown as Env;
		let channelRollupDeletes = 0;
		let gameRollupDeletes = 0;

		const db = makeDb({
			sampleRows: [],
			channelRollupRows: [
				{
					channel_id: 'ch-1',
					date: '2026-02-01',
					hours_watched: 1,
					average_viewers: 1,
					peak_viewers: 2,
					airtime_minutes: 60,
					stream_count: 1,
					followers_delta: null
				}
			],
			gameRollupRows: [
				{
					game_category_id: 'g-1',
					date: '2026-02-01',
					hours_watched: 2,
					average_viewers: 2,
					peak_viewers: 5,
					airtime_minutes: 120,
					live_channels: 3
				}
			],
			onChannelRollupDelete: () => {
				channelRollupDeletes += 1;
				return 1;
			},
			onGameRollupDelete: () => {
				gameRollupDeletes += 1;
				return 1;
			}
		});

		env.DB = db;
		const stats = await runRetentionWithColdArchive(env, NOW);
		expect(stats.channelRollupsPruned).toBe(1);
		expect(stats.gameRollupsPruned).toBe(1);
		expect(channelRollupDeletes).toBe(1);
		expect(gameRollupDeletes).toBe(1);
		expect(coldArchiveR2.archiveRowsToColdStorage).toHaveBeenCalledTimes(2);
	});

	it('continues sample archive batches until fewer than batch size remain', async () => {
		const env = { DB: undefined as unknown as D1Database, COLD_ARCHIVE_ENABLED: '1', SAMPLES: {} } as unknown as Env;
		const fullBatch = Array.from({ length: VIEWER_SAMPLE_DELETE_BATCH_SIZE }, (_, i) => ({
			id: i + 1,
			stream_session_id: `sess-${i}`,
			sampled_at: '2026-05-01T00:00:00.000Z',
			viewer_count: 1,
			channel_id: 'ch-1',
			platform_id: 'twitch'
		}));
		const tailBatch = [
			{
				id: 999,
				stream_session_id: 'sess-tail',
				sampled_at: '2026-05-01T00:00:00.000Z',
				viewer_count: 1,
				channel_id: 'ch-1',
				platform_id: 'twitch'
			}
		];
		let sampleFetch = 0;
		const db = makeDb({
			sampleRows: [],
			onSampleDelete: (ids) => ids.length
		});
		const originalPrepare = db.prepare.bind(db);
		db.prepare = (sql: string) => {
			if (sql.includes('FROM viewer_samples vs') && sql.includes('SELECT vs.id')) {
				return {
					bind(_cutoff: string, _limit: number) {
						return {
							all: async () => {
								sampleFetch += 1;
								if (sampleFetch === 1) return { results: fullBatch };
								if (sampleFetch === 2) return { results: tailBatch };
								return { results: [] };
							}
						};
					}
				};
			}
			return originalPrepare(sql);
		};

		env.DB = db;
		const stats = await runRetentionWithColdArchive(env, NOW);
		expect(stats.viewerSamplesPruned).toBe(VIEWER_SAMPLE_DELETE_BATCH_SIZE + 1);
		expect(coldArchiveR2.archiveRowsToColdStorage).toHaveBeenCalledTimes(2);
	});

	it('counts zero when delete statements omit meta', async () => {
		const env = { DB: undefined as unknown as D1Database, COLD_ARCHIVE_ENABLED: '1', SAMPLES: {} } as unknown as Env;
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM viewer_samples vs') && sql.includes('SELECT vs.id')) {
					let calls = 0;
					return {
						bind: () => ({
							all: async () => {
								calls += 1;
								if (calls > 1) return { results: [] };
								return {
									results: [
										{
											id: 1,
											stream_session_id: 's',
											sampled_at: '2026-05-01T00:00:00.000Z',
											viewer_count: 1,
											channel_id: 'c',
											platform_id: 'twitch'
										}
									]
								};
							}
						})
					};
				}
				if (sql.includes('DELETE FROM viewer_samples') && sql.includes('json_each')) {
					return { bind: () => ({ run: async () => ({}) }) };
				}
				if (sql.includes('FROM channel_daily_rollups') || sql.includes('FROM game_daily_rollups')) {
					return { bind: () => ({ all: async () => ({ results: [] }) }) };
				}
				return { bind: () => ({ run: async () => ({}), all: async () => ({ results: [] }) }) };
			}
		} as unknown as D1Database;
		env.DB = db;
		const stats = await runRetentionWithColdArchive(env, NOW);
		expect(stats.viewerSamplesPruned).toBe(0);
		expect(coldArchiveR2.archiveRowsToColdStorage).toHaveBeenCalledOnce();
	});

	it('treats null D1 results as empty', async () => {
		const env = { DB: undefined as unknown as D1Database, COLD_ARCHIVE_ENABLED: '1', SAMPLES: {} } as unknown as Env;
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM channel_daily_rollups') && sql.includes('SELECT channel_id')) {
					return {
						bind: () => ({ all: async () => ({ results: null }) })
					};
				}
				if (sql.includes('FROM game_daily_rollups') && sql.includes('SELECT game_category_id')) {
					return {
						bind: () => ({ all: async () => ({ results: null }) })
					};
				}
				if (sql.includes('FROM viewer_samples vs') && sql.includes('SELECT vs.id')) {
					return {
						bind: () => ({ all: async () => ({ results: null }) })
					};
				}
				return {
					bind: () => ({
						run: async () => ({}),
						all: async () => ({ results: [] })
					})
				};
			}
		} as unknown as D1Database;
		env.DB = db;
		await expect(runRetentionWithColdArchive(env, NOW)).resolves.toEqual({
			viewerSamplesPruned: 0,
			channelRollupsPruned: 0,
			gameRollupsPruned: 0
		});
	});
});

type SampleRow = {
	id: number;
	stream_session_id: string;
	sampled_at: string;
	viewer_count: number;
	channel_id: string;
	platform_id: string;
};

function makeDb(opts: {
	sampleRows: SampleRow[];
	channelRollupRows?: Record<string, unknown>[];
	gameRollupRows?: Record<string, unknown>[];
	onSampleDelete?: (ids: number[]) => number;
	onChannelRollupDelete?: () => number;
	onGameRollupDelete?: () => number;
}) {
	let sampleSelectCount = 0;
	let channelSelectCount = 0;
	let gameSelectCount = 0;

	return {
		prepare(sql: string) {
			if (sql.startsWith('DELETE FROM viewer_samples') && sql.includes('json_each')) {
				return {
					bind: (idsJson: string) => ({
						run: async () => {
							const ids = JSON.parse(idsJson) as number[];
							return { meta: { changes: opts.onSampleDelete?.(ids) ?? ids.length } };
						}
					})
				};
			}
			if (sql.startsWith('DELETE FROM viewer_samples')) {
				return {
					bind: () => ({
						run: async () => {
							const changes = opts.onSampleDelete?.([1]) ?? 1;
							return { meta: { changes } };
						}
					})
				};
			}
			if (sql.startsWith('DELETE FROM channel_daily_rollups') && sql.includes('channel_id = ?')) {
				return {
					bind: () => ({
						run: async () => ({ meta: { changes: opts.onChannelRollupDelete?.() ?? 1 } })
					})
				};
			}
			if (sql.startsWith('DELETE FROM channel_daily_rollups')) {
				return {
					bind: () => ({
						run: async () => ({ meta: { changes: opts.onChannelRollupDelete?.() ?? 0 } })
					})
				};
			}
			if (sql.startsWith('DELETE FROM game_daily_rollups') && sql.includes('game_category_id = ?')) {
				return {
					bind: () => ({
						run: async () => ({ meta: { changes: opts.onGameRollupDelete?.() ?? 1 } })
					})
				};
			}
			if (sql.startsWith('DELETE FROM game_daily_rollups')) {
				return {
					bind: () => ({
						run: async () => ({ meta: { changes: opts.onGameRollupDelete?.() ?? 0 } })
					})
				};
			}
			if (sql.includes('FROM viewer_samples vs') && sql.includes('SELECT vs.id')) {
				return {
					bind(_cutoff: string, _limit: number) {
						return {
							all: async () => {
								sampleSelectCount += 1;
								if (sampleSelectCount > 1) return { results: [] };
								return { results: opts.sampleRows };
							}
						};
					}
				};
			}
			if (sql.includes('FROM channel_daily_rollups') && sql.includes('SELECT channel_id')) {
				return {
					bind(_cutoff: string, _limit: number) {
						return {
							all: async () => {
								channelSelectCount += 1;
								if (channelSelectCount > 1) return { results: [] };
								return { results: opts.channelRollupRows ?? [] };
							}
						};
					}
				};
			}
			if (sql.includes('FROM game_daily_rollups') && sql.includes('SELECT game_category_id')) {
				return {
					bind(_cutoff: string, _limit: number) {
						return {
							all: async () => {
								gameSelectCount += 1;
								if (gameSelectCount > 1) return { results: [] };
								return { results: opts.gameRollupRows ?? [] };
							}
						};
					}
				};
			}
			return {
				bind: () => ({
					run: async () => ({ meta: { changes: 0 } }),
					all: async () => ({ results: [] })
				})
			};
		}
	} as unknown as D1Database;
}
