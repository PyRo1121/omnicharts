import { describe, it, expect, vi } from 'vitest';
import { mockIngestD1, testEnv } from './helpers';
import type { KickLivestream } from '../src/kick/types';
import {
	batchRecordKickLiveSamples,
	batchUpsertKickChannelsFromLivestreams,
	batchUpsertKickGameCategories,
} from '../src/db/kick-live-batch';

function mockDb() {
	const runs: string[] = [];
	const batch = vi.fn(async (statements: { run: () => Promise<unknown> }[]) => {
		await Promise.all(statements.map((stmt) => stmt.run()));
		return [];
	});
	const prepare = vi.fn((sql: string) => ({
		bind: (..._args: unknown[]) => ({
			run: async () => {
				runs.push(sql);
				return { meta: { changes: 1 } };
			},
			all: async () => ({ results: [] as unknown[] }),
			first: async () => null,
		}),
	}));
	return {
		db: mockIngestD1((sql) => prepare(sql), batch),
		runs,
		prepare,
		batch,
	};
}

const baseStream = (over: Partial<KickLivestream> = {}): KickLivestream => ({
	broadcaster_user_id: 42,
	channel_id: 420,
	slug: 'streamer',
	stream_title: 'Live title',
	started_at: '2026-06-01T12:00:00Z',
	viewer_count: 100,
	category: { id: 7, name: 'Just Chatting' },
	...over,
});

describe('batchUpsertKickGameCategories', () => {
	it('multi-row INSERT with ON CONFLICT and dedupes by platform category id', async () => {
		const { db, prepare } = mockDb();
		const map = await batchUpsertKickGameCategories(db, [
			{ id: 7, name: 'Just Chatting' },
			{ id: 7, name: 'Just Chatting' },
			{ id: 9, name: 'IRL' },
		]);
		expect(map.get('7')).toBe('kick-game-7');
		expect(map.get('9')).toBe('kick-game-9');
		expect(prepare).toHaveBeenCalled();
		expect(prepare.mock.calls[0]?.[0]).toContain('ON CONFLICT');
	});

	it('returns empty map for no categories', async () => {
		const { db } = mockDb();
		expect(await batchUpsertKickGameCategories(db, [])).toEqual(new Map());
	});

	it('skips non-finite category ids', async () => {
		const { db, prepare } = mockDb();
		const map = await batchUpsertKickGameCategories(db, [
			{ id: Number.NaN, name: 'Bad' },
			{ id: 3, name: 'Good' },
		]);
		expect(map.size).toBe(1);
		expect(prepare).toHaveBeenCalledTimes(1);
	});
});

describe('batchUpsertKickChannelsFromLivestreams', () => {
	it('inserts discovered channel and records live sighting when eligible', async () => {
		const { db, runs } = mockDb();
		const map = await batchUpsertKickChannelsFromLivestreams(db, [baseStream({ viewer_count: 50 })], {
			minViewers: 5,
			promoteToTracked: true,
		});
		expect(map.get('42')).toBe('kick-ch-42');
		expect(runs.some((s) => s.includes('INSERT INTO channels'))).toBe(true);
		expect(runs.some((s) => s.includes('channel_live_sightings'))).toBe(true);
	});

	it('skips sighting when viewer_count below minViewers', async () => {
		const { db, runs } = mockDb();
		await batchUpsertKickChannelsFromLivestreams(db, [baseStream({ viewer_count: 2 })], { minViewers: 5, promoteToTracked: true });
		expect(runs.some((s) => s.includes('channel_live_sightings'))).toBe(false);
	});

	it('skips sighting when viewer_count is hidden', async () => {
		const { db, runs } = mockDb();
		await batchUpsertKickChannelsFromLivestreams(db, [baseStream({ viewer_count: null })], { minViewers: 5, promoteToTracked: true });
		expect(runs.some((s) => s.includes('channel_live_sightings'))).toBe(false);
	});

	it('uses slug fallback when slug collides with another broadcaster', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) {
						return { results: [] };
					}
					if (sql.includes('slug IN')) {
						return { results: [{ slug: 'streamer', platform_channel_id: '99' }] };
					}
					return { results: [] };
				},
				first: async () => null,
			}),
		}));
		const db = mockIngestD1(
			(sql) => prepare(sql),
			vi.fn(async () => []),
		);

		await batchUpsertKickChannelsFromLivestreams(db, [baseStream({ broadcaster_user_id: 42, slug: 'streamer' })], {
			minViewers: 5,
			promoteToTracked: false,
		});

		const channelInsert = prepare.mock.calls.find(([sql]) => sql.includes('INSERT INTO channels'));
		expect(channelInsert).toBeTruthy();
	});

	it('writes slug_history when existing channel slug changes', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) {
						return {
							results: [
								{
									id: 'kick-ch-42',
									slug: 'old-slug',
									ingest_state: 'tracked',
									first_observed_at: '2026-01-01T00:00:00Z',
									platform_channel_id: '42',
								},
							],
						};
					}
					return { results: [] };
				},
				first: async () => null,
			}),
		}));
		const batch = vi.fn(async () => []);
		const db = mockIngestD1((sql) => prepare(sql), batch);

		await batchUpsertKickChannelsFromLivestreams(db, [baseStream({ slug: 'new-slug' })], { minViewers: 5, promoteToTracked: false });

		expect(batch).toHaveBeenCalled();
		expect(prepare.mock.calls.some(([sql]) => sql.includes('INSERT INTO slug_history'))).toBe(true);
	});

	it('uses lightweight last_seen UPDATE for unchanged tracked channel', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) {
						return {
							results: [
								{
									id: 'kick-ch-42',
									slug: 'streamer',
									display_name: 'streamer',
									language: null,
									ingest_state: 'tracked',
									first_observed_at: '2026-01-01T00:00:00Z',
									platform_channel_id: '42',
								},
							],
						};
					}
					return { results: [] };
				},
				first: async () => null,
			}),
		}));
		const batch = vi.fn(async () => []);
		const db = mockIngestD1((sql) => prepare(sql), batch);

		await batchUpsertKickChannelsFromLivestreams(db, [baseStream()], { minViewers: 5, promoteToTracked: true });

		expect(prepare.mock.calls.some(([sql]) => sql.includes('UPDATE channels SET last_seen_at'))).toBe(true);
		expect(prepare.mock.calls.some(([sql]) => sql.includes('INSERT INTO channels'))).toBe(false);
	});

	it('promotes discovered channel immediately for directoryListing', async () => {
		const { db, runs } = mockDb();
		await batchUpsertKickChannelsFromLivestreams(db, [baseStream({ viewer_count: 100 })], {
			minViewers: 5,
			promoteToTracked: true,
			directoryListing: true,
		});
		expect(runs.some((s) => s.includes("ingest_state = 'tracked'") || s.includes('tracked'))).toBe(true);
	});

	it('leaves retired channel ingest_state unchanged', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) {
						return {
							results: [
								{
									id: 'kick-ch-42',
									slug: 'streamer',
									ingest_state: 'retired',
									first_observed_at: '2026-01-01T00:00:00Z',
									platform_channel_id: '42',
								},
							],
						};
					}
					return { results: [] };
				},
				first: async () => null,
			}),
		}));
		const db = mockIngestD1(
			(sql) => prepare(sql),
			vi.fn(async () => []),
		);

		await batchUpsertKickChannelsFromLivestreams(db, [baseStream()], { minViewers: 5, promoteToTracked: true, directoryListing: true });

		const insertSql = prepare.mock.calls.find(([sql]) => sql.includes('INSERT INTO channels'));
		expect(insertSql?.[0]).toContain("'retired'");
	});
});

describe('batchRecordKickLiveSamples', () => {
	it('INSERTs viewer_samples for known viewer_count', async () => {
		const { db, runs } = mockDb();
		const archive = await batchRecordKickLiveSamples(db, [
			{
				channelId: 'kick-ch-42',
				stream: baseStream(),
				gameCategoryId: 'kick-game-7',
			},
		]);
		expect(archive).toHaveLength(1);
		expect(archive[0]?.platform).toBe('kick');
		expect(runs.some((s) => s.includes('INSERT INTO viewer_samples'))).toBe(true);
	});

	it('accepts batchOpts env for D1 meta logging on viewer samples', async () => {
		const { db, runs } = mockDb();
		await batchRecordKickLiveSamples(db, [{ channelId: 'kick-ch-42', stream: baseStream(), gameCategoryId: 'kick-game-7' }], {
			env: testEnv(),
			scope: 'kick:samples',
		});
		expect(runs.some((s) => s.includes('INSERT INTO viewer_samples'))).toBe(true);
	});

	it('returns empty when viewer_count hidden', async () => {
		const { db } = mockDb();
		const archive = await batchRecordKickLiveSamples(db, [
			{
				channelId: 'kick-ch-42',
				stream: baseStream({ viewer_count: undefined }),
				gameCategoryId: null,
			},
		]);
		expect(archive).toEqual([]);
	});

	it('updates open session when platform_stream_id unchanged', async () => {
		const platformStreamId = '420-2026-06-01T12:00:00Z';
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('ended_at IS NULL')) {
						return {
							results: [
								{
									id: 'sess-1',
									channel_id: 'kick-ch-42',
									platform_stream_id: platformStreamId,
									started_at: '2026-06-01T12:00:00Z',
									title: 'Old title',
									game_category_id: 'kick-game-7',
									language: null,
									tags_json: null,
									thumbnail_url: null,
									stream_type: 'live',
								},
							],
						};
					}
					return { results: [] };
				},
			}),
		}));
		const batch = vi.fn(async () => []);
		const db = mockIngestD1((sql) => prepare(sql), batch);

		await batchRecordKickLiveSamples(db, [
			{
				channelId: 'kick-ch-42',
				stream: baseStream({ stream_title: 'Live title' }),
				gameCategoryId: 'kick-game-7',
			},
		]);

		expect(prepare.mock.calls.some(([sql]) => sql.includes('UPDATE stream_sessions SET'))).toBe(true);
	});

	it('skips session UPDATE when open session metadata unchanged', async () => {
		const platformStreamId = '420-2026-06-01T12:00:00Z';
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('ended_at IS NULL')) {
						return {
							results: [
								{
									id: 'sess-1',
									channel_id: 'kick-ch-42',
									platform_stream_id: platformStreamId,
									started_at: '2026-06-01T12:00:00Z',
									title: 'Live title',
									game_category_id: 'kick-game-7',
									language: null,
									tags_json: null,
									thumbnail_url: null,
									stream_type: 'live',
								},
							],
						};
					}
					return { results: [] };
				},
			}),
		}));
		const batch = vi.fn(async () => []);
		const db = mockIngestD1((sql) => prepare(sql), batch);

		await batchRecordKickLiveSamples(db, [
			{
				channelId: 'kick-ch-42',
				stream: baseStream(),
				gameCategoryId: 'kick-game-7',
			},
		]);

		expect(prepare.mock.calls.some(([sql]) => sql.includes('UPDATE stream_sessions SET'))).toBe(false);
		expect(prepare.mock.calls.some(([sql]) => sql.includes('INSERT INTO viewer_samples'))).toBe(true);
	});

	it('closes stale session and inserts new session when platform_stream_id changes', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('ended_at IS NULL')) {
						return {
							results: [
								{
									id: 'sess-old',
									channel_id: 'kick-ch-42',
									platform_stream_id: '420-2026-06-01T10:00:00Z',
									started_at: '2026-06-01T10:00:00Z',
								},
							],
						};
					}
					return { results: [] };
				},
			}),
		}));
		const batch = vi.fn(async () => []);
		const db = mockIngestD1((sql) => prepare(sql), batch);

		await batchRecordKickLiveSamples(db, [
			{
				channelId: 'kick-ch-42',
				stream: baseStream({ started_at: '2026-06-01T12:00:00Z' }),
				gameCategoryId: null,
			},
		]);

		expect(batch).toHaveBeenCalled();
		expect(prepare.mock.calls.some(([sql]) => sql.includes('INSERT INTO stream_sessions'))).toBe(true);
	});

	it('upserts game category inline when stream has category and no gameCategoryId', async () => {
		const { db, prepare } = mockDb();
		await batchRecordKickLiveSamples(db, [
			{
				channelId: 'kick-ch-42',
				stream: baseStream({ category: { id: 12, name: 'Rust' } }),
				gameCategoryId: null,
			},
		]);
		expect(prepare.mock.calls.some(([sql]) => sql.includes('INSERT INTO game_categories'))).toBe(true);
	});

	it('promotes discovered channel to tracked after enough sightings', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) return { results: [] };
					if (sql.includes('slug IN')) return { results: [] };
					if (sql.includes('channel_live_sightings') && sql.includes('COUNT(*)')) {
						return { results: [{ channel_id: 'kick-ch-42', n: 2 }] };
					}
					return { results: [] };
				},
				first: async () => null,
			}),
		}));
		const batch = vi.fn(async () => []);
		const db = mockIngestD1((sql) => prepare(sql), batch);

		await batchUpsertKickChannelsFromLivestreams(db, [baseStream({ viewer_count: 50 })], { minViewers: 5, promoteToTracked: true });

		expect(prepare.mock.calls.some(([sql]) => sql.includes("ingest_state = 'tracked'"))).toBe(true);
	});

	it('promotes dormant channel to tracked when eligible', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) {
						return {
							results: [
								{
									id: 'kick-ch-42',
									slug: 'streamer',
									ingest_state: 'dormant',
									first_observed_at: '2026-01-01T00:00:00Z',
									platform_channel_id: '42',
								},
							],
						};
					}
					return { results: [] };
				},
				first: async () => null,
			}),
		}));
		const db = mockIngestD1(
			(sql) => prepare(sql),
			vi.fn(async () => []),
		);

		await batchUpsertKickChannelsFromLivestreams(db, [baseStream({ viewer_count: 50 })], { minViewers: 5, promoteToTracked: true });

		const channelSql = prepare.mock.calls.find(([sql]) => sql.includes('INSERT INTO channels'));
		expect(channelSql?.[0]).toContain("'tracked'");
	});

	it('keeps tracked ingest_state for already tracked channel', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) {
						return {
							results: [
								{
									id: 'kick-ch-42',
									slug: 'streamer',
									ingest_state: 'tracked',
									first_observed_at: '2026-01-01T00:00:00Z',
									platform_channel_id: '42',
								},
							],
						};
					}
					return { results: [] };
				},
				first: async () => null,
			}),
		}));
		const db = mockIngestD1(
			(sql) => prepare(sql),
			vi.fn(async () => []),
		);

		await batchUpsertKickChannelsFromLivestreams(db, [baseStream()], { minViewers: 5, promoteToTracked: true });

		expect(prepare.mock.calls.some(([sql]) => sql.includes('INSERT INTO channels'))).toBe(true);
	});
});
