import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv } from './helpers';
import * as twitchDb from '../src/db/twitch';
import { TwitchHelixClient } from '../src/twitch/helix';
import { enqueueTwitchPollShards, runTwitchPollBatch } from '../src/twitch/poll';

describe('twitch poll', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('enqueueTwitchPollShards sends one consolidated catalog message', async () => {
		const send = vi.fn().mockResolvedValue(undefined);
		const env = testEnv({
			INGEST_QUEUE: { send, sendBatch: vi.fn(), metrics: vi.fn() },
		});

		const messages = await enqueueTwitchPollShards(env);
		expect(messages).toBe(1);
		expect(send).toHaveBeenCalledWith({ body: { type: 'poll_twitch_catalog' } });
	});

	it('runTwitchPollBatch records samples for live streams above min viewers', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByUserIds').mockResolvedValue([
			{
				id: 's1',
				user_id: '10',
				user_login: 'ten',
				user_name: 'Ten',
				game_id: 'g',
				game_name: 'G',
				title: 'T',
				viewer_count: 50,
				started_at: '2026-06-01T00:00:00Z',
				type: 'live',
			},
		]);
		vi.spyOn(twitchDb, 'batchUpsertGameCategories').mockResolvedValue(new Map([['g', 'game-1']]));
		vi.spyOn(twitchDb, 'batchUpsertChannelsFromStreams').mockResolvedValue(new Map([['10', 'ch-1']]));
		vi.spyOn(twitchDb, 'batchRecordLiveSamples').mockResolvedValue([
			{
				stream_session_id: 'sess',
				sampled_at: '2026-06-01T00:00:00Z',
				viewer_count: 50,
				platform: 'twitch',
			},
		]);

		const runs: string[] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: () => ({
						run: async () => {
							runs.push(sql);
							return {};
						},
					}),
				};
			},
			batch: async (statements: { run: () => Promise<unknown> }[]) => {
				await Promise.all(statements.map((stmt) => stmt.run()));
				return [];
			},
		};

		const result = await runTwitchPollBatch(testEnv({ TWITCH_MIN_VIEWERS: '5', DB: db }), ['10', '11']);

		expect(result.liveStreams).toBe(1);
		expect(result.samplesWritten).toBe(1);
		expect(runs.some((s) => s.includes('last_seen_at'))).toBe(true);
	});
});
