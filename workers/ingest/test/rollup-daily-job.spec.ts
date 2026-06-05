import { describe, it, expect, vi } from 'vitest';
import { testEnv } from './helpers';

vi.mock('../src/twitch/enrich-profiles', () => ({
	enrichFollowersBeforeRollup: vi.fn().mockResolvedValue(undefined),
	runTwitchProfileEnrichment: vi.fn(),
}));

import { runDailyRollup, upsertChannelDailyRollup } from '../src/rollup/daily-job';
import { enrichFollowersBeforeRollup } from '../src/twitch/enrich-profiles';

const DATE = '2026-05-30';

function mockDbForRollup(
	sampleRows: {
		sampled_at: string;
		viewer_count: number;
		session_id: string;
		channel_id: string;
		game_category_id: string | null;
	}[],
	opts?: { followerCount?: number; priorSnapshot?: number },
) {
	const channelRollups: unknown[][] = [];
	const gameRollups: unknown[][] = [];
	let metadataWritten = false;
	let pruneCalls = 0;

	const db = {
		prepare(sql: string) {
			if (sql.includes('FROM viewer_samples') && sql.includes('SELECT vs')) {
				return {
					bind() {
						return { all: async () => ({ results: sampleRows }) };
					},
				};
			}
			if (sql.includes('DELETE FROM viewer_samples')) {
				return {
					bind() {
						return {
							run: async () => {
								pruneCalls += 1;
								return { meta: { changes: 0 } };
							},
						};
					},
				};
			}
			if (sql.includes('SELECT id, follower_count FROM channels')) {
				return {
					bind() {
						return {
							all: async () => ({
								results: [{ id: 'ch-1', follower_count: opts?.followerCount ?? 5000 }],
							}),
						};
					},
				};
			}
			if (sql.includes('SELECT key, value FROM ingest_metadata')) {
				return {
					bind() {
						return {
							all: async () =>
								opts?.priorSnapshot != null
									? {
											results: [
												{
													key: 'follower_eod:ch-1',
													value: String(opts.priorSnapshot),
												},
											],
										}
									: { results: [] },
						};
					},
				};
			}
			if (sql.includes('INSERT INTO channel_daily_rollups')) {
				return {
					bind(...args: unknown[]) {
						channelRollups.push(args);
						return { run: async () => ({ meta: { rows_written: 1 } }) };
					},
				};
			}
			if (sql.includes('INSERT INTO game_daily_rollups')) {
				return {
					bind(...args: unknown[]) {
						gameRollups.push(args);
						return { run: async () => ({ meta: { rows_written: 1 } }) };
					},
				};
			}
			if (sql.includes('ingest_metadata')) {
				return {
					bind() {
						return {
							run: async () => {
								metadataWritten = true;
								return { meta: { changes: 0 } };
							},
						};
					},
				};
			}
			if (sql.includes("ingest_state = 'dormant'")) {
				return {
					bind() {
						return { run: async () => ({ meta: { changes: 0 } }) };
					},
				};
			}
			return { bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) };
		},
		async batch(statements: { run: () => Promise<unknown> }[]) {
			const results = [];
			for (const stmt of statements) {
				results.push(await stmt.run());
			}
			return results;
		},
	};

	return {
		db,
		channelRollups,
		gameRollups,
		wasMetadataWritten: () => metadataWritten,
		pruneCalls: () => pruneCalls,
	};
}

describe('runDailyRollup', () => {
	it('calls enrichFollowersBeforeRollup for the rollup date', async () => {
		const { db } = mockDbForRollup([]);
		await runDailyRollup(testEnv({ DB: db }), DATE);
		expect(enrichFollowersBeforeRollup).toHaveBeenCalledWith({ DB: db }, DATE);
	});

	it('aggregates samples into channel and game rollups', async () => {
		const { db, channelRollups, gameRollups, wasMetadataWritten, pruneCalls } = mockDbForRollup([
			{
				sampled_at: `${DATE}T12:00:00.000Z`,
				viewer_count: 100,
				session_id: 'sess-1',
				channel_id: 'ch-1',
				game_category_id: 'game-1',
			},
			{
				sampled_at: `${DATE}T12:30:00.000Z`,
				viewer_count: 100,
				session_id: 'sess-1',
				channel_id: 'ch-1',
				game_category_id: 'game-1',
			},
		]);

		const stats = await runDailyRollup(testEnv({ DB: db }), DATE);
		expect(stats.date).toBe(DATE);
		expect(stats.channelsProcessed).toBe(1);
		expect(stats.gameCategoriesProcessed).toBe(1);
		expect(stats.viewerSamplesPruned).toBe(0);
		expect(channelRollups).toHaveLength(1);
		expect(channelRollups[0]?.[2]).toBeCloseTo(50, 1);
		expect(gameRollups).toHaveLength(1);
		expect(wasMetadataWritten()).toBe(true);
		expect(pruneCalls()).toBeGreaterThanOrEqual(1);
	});

	it('stores followers_delta from prior snapshot vs current follower_count', async () => {
		const { db, channelRollups } = mockDbForRollup(
			[
				{
					sampled_at: `${DATE}T12:00:00.000Z`,
					viewer_count: 50,
					session_id: 'sess-1',
					channel_id: 'ch-1',
					game_category_id: null,
				},
			],
			{ followerCount: 1200, priorSnapshot: 1000 },
		);

		await runDailyRollup(testEnv({ DB: db }), DATE);
		expect(channelRollups[0]?.[7]).toBe(200);
	});
});

describe('upsertChannelDailyRollup', () => {
	it('binds metric columns and followers_delta', async () => {
		let bound: unknown[] = [];
		const db = {
			prepare() {
				return {
					bind(...args: unknown[]) {
						bound = args;
						return { run: async () => ({}) };
					},
				};
			},
		};

		await upsertChannelDailyRollup(
			db,
			'ch-1',
			DATE,
			{
				hoursWatched: 10,
				averageViewers: 5,
				peakViewers: 20,
				airtimeMinutes: 120,
				streamCount: 2,
			},
			42,
		);

		expect(bound[0]).toBe('ch-1');
		expect(bound[2]).toBe(10);
		expect(bound[6]).toBe(2);
		expect(bound[7]).toBe(42);
	});
});
