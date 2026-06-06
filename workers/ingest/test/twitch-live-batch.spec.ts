import { describe, it, expect, vi } from 'vitest';
import { testEnv, unusedIngestD1, mockIngestD1 } from './helpers';
import type { HelixStream } from '../src/twitch/helix';
import { runTwitchPollBatch } from '../src/twitch/poll';
import { D1_BATCH_MAX_STATEMENTS } from '../src/db/d1-batch';
import { batchRecordLiveSamples, batchUpsertChannelsFromStreams, batchUpsertGameCategories } from '../src/db/twitch-live-batch';

vi.mock('../src/twitch/helix', () => ({
	TwitchHelixClient: class {
		async getStreamsByUserIds() {
			return [
				{
					id: 's1',
					user_id: '1',
					user_login: 'u1',
					user_name: 'U1',
					game_id: '10',
					game_name: 'G',
					title: 'T',
					viewer_count: 100,
					started_at: '2026-06-01T00:00:00Z',
					type: 'live',
				},
			] satisfies HelixStream[];
		}
	},
}));

describe('D1 batch constants', () => {
	it('caps batch() at 50 per Cloudflare D1 / Worker Free subrequest guidance', () => {
		expect(D1_BATCH_MAX_STATEMENTS).toBe(50);
	});
});

describe('batchUpsertGameCategories', () => {
	it('uses multi-row INSERT with ON CONFLICT', async () => {
		const run = vi.fn().mockResolvedValue({ success: true });
		const prepare = vi.fn(() => ({ bind: vi.fn().mockReturnValue({ run }) }));
		const db = mockIngestD1((sql) => prepare(sql), vi.fn());

		const map = await batchUpsertGameCategories(db, [
			{ id: '1', name: 'A' },
			{ id: '2', name: 'B' },
		]);

		expect(map.get('1')).toBe('twitch-game-1');
		expect(prepare).toHaveBeenCalledTimes(1);
		expect(prepare.mock.calls[0][0]).toContain('VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)');
	});

	it('skips games with empty id and slugifies fallback name', async () => {
		const run = vi.fn().mockResolvedValue({ success: true });
		const prepare = vi.fn(() => ({ bind: vi.fn().mockReturnValue({ run }) }));
		const db = mockIngestD1((sql) => prepare(sql), vi.fn());

		const map = await batchUpsertGameCategories(db, [
			{ id: '', name: 'Bad' },
			{ id: '99', name: '!!!' },
		]);

		expect(map.get('99')).toBe('twitch-game-99');
		expect(prepare).toHaveBeenCalledTimes(1);
	});
});

describe('batchUpsertChannelsFromStreams', () => {
	const stream: HelixStream = {
		id: 's1',
		user_id: '42',
		user_login: 'streamer',
		user_name: 'Streamer',
		game_id: '10',
		game_name: 'G',
		title: 'T',
		viewer_count: 100,
		started_at: '2026-06-01T00:00:00Z',
		type: 'live',
	};

	it('returns empty map for no streams', async () => {
		expect(await batchUpsertChannelsFromStreams(unusedIngestD1(), [], { minViewers: 5, promoteToTracked: true })).toEqual(new Map());
	});

	it('inserts discovered channel and records sighting', async () => {
		const batch = vi.fn(async () => []);
		const prepare = vi.fn((_sql: string) => ({
			bind: () => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => ({ results: [] }),
			}),
		}));
		const db = mockIngestD1((sql) => prepare(sql), batch);

		const map = await batchUpsertChannelsFromStreams(db, [stream], {
			minViewers: 5,
			promoteToTracked: true,
		});
		expect(map.get('42')).toBe('twitch-ch-42');
		expect(batch).toHaveBeenCalled();
	});

	it('promotes dormant channel when viewer threshold met', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: () => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) {
						return {
							results: [
								{
									id: 'twitch-ch-42',
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
			}),
		}));
		const db = mockIngestD1(
			(sql) => prepare(sql),
			vi.fn(async () => []),
		);

		await batchUpsertChannelsFromStreams(db, [stream], { minViewers: 5, promoteToTracked: true });
		expect(prepare.mock.calls.some(([sql]) => sql.includes('INSERT INTO channels'))).toBe(true);
	});

	it('writes slug_history when existing twitch channel slug changes', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: () => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('platform_channel_id IN')) {
						return {
							results: [
								{
									id: 'twitch-ch-42',
									slug: 'old-login',
									ingest_state: 'tracked',
									first_observed_at: '2026-01-01T00:00:00Z',
									platform_channel_id: '42',
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

		await batchUpsertChannelsFromStreams(db, [{ ...stream, user_login: 'new-login' }], { minViewers: 5, promoteToTracked: false });

		expect(batch).toHaveBeenCalled();
		expect(prepare.mock.calls.some(([sql]) => sql.includes('slug_history'))).toBe(true);
	});
});

describe('runTwitchPollBatch live ingest', () => {
	it('batch path uses DB.batch for offline updates', async () => {
		const batch = vi.fn().mockResolvedValue([]);
		const run = vi.fn().mockResolvedValue({ success: true });
		const prepare = vi.fn((sql: string) => {
			const stmt = {
				sql,
				bind: vi.fn().mockReturnValue({
					run,
					all: vi.fn().mockResolvedValue({ results: [] }),
				}),
			};
			return stmt;
		});

		const userIds = Array.from({ length: 75 }, (_, i) => String(i));
		const db = mockIngestD1((sql) => prepare(sql), batch);
		const env = testEnv({
			DB: db,
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'secret',
			TWITCH_MIN_VIEWERS: '2',
		});

		await runTwitchPollBatch(env, userIds);

		expect(batch).toHaveBeenCalled();
		expect(prepare.mock.calls.filter(([sql]) => sql.includes('last_seen_at')).length).toBe(75);
		expect(prepare.mock.calls.some(([sql]) => sql.includes('UPDATE stream_sessions SET ended_at'))).toBe(true);
	});
});

describe('batchRecordLiveSamples', () => {
	it('multi-row INSERTs viewer_samples', async () => {
		const batch = vi.fn().mockResolvedValue([]);
		const run = vi.fn().mockResolvedValue({ success: true });
		const prepare = vi.fn((sql: string) => ({
			bind: vi.fn().mockReturnValue({
				run,
				sql,
				all: vi.fn().mockResolvedValue({ results: [] }),
			}),
		}));

		const db = mockIngestD1((sql) => prepare(sql), batch);
		const stream: HelixStream = {
			id: 's1',
			user_id: '1',
			user_login: 'u1',
			user_name: 'U1',
			game_id: '10',
			game_name: 'G',
			title: 'T',
			viewer_count: 50,
			started_at: '2026-06-01T00:00:00Z',
			type: 'live',
		};

		await batchRecordLiveSamples(db, [{ channelId: 'twitch-ch-1', stream, gameCategoryId: 'twitch-game-10' }]);

		const sampleInsert = prepare.mock.calls.find((c) => c[0].includes('INSERT INTO viewer_samples'));
		expect(sampleInsert?.[0]).toContain('VALUES (?, ?, ?)');
	});
});
