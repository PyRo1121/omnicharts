import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as kickDb from '../src/db/kick-live-batch';
import { KickPublicApiClient } from '../src/kick/api';
import { runKickCatalogPoll, runKickPollBatch } from '../src/kick/poll';

describe('kick poll', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('runKickCatalogPoll returns NEEDS_API when credentials missing', async () => {
		const result = await runKickCatalogPoll({} as Env);
		expect(result.skipped).toBe('NEEDS_API');
		expect(result.batches).toBe(0);
	});

	it('runKickPollBatch records samples for live streams above min viewers', async () => {
		vi.spyOn(KickPublicApiClient.prototype, 'getLivestreamsByBroadcasterIds').mockResolvedValue([
			{
				broadcaster_user_id: 10,
				channel_id: 100,
				slug: 'ten',
				stream_title: 'T',
				started_at: '2026-06-01T00:00:00Z',
				viewer_count: 50,
				category: { id: 7, name: 'IRL' }
			}
		]);
		vi.spyOn(kickDb, 'batchUpsertKickGameCategories').mockResolvedValue(new Map([['7', 'game-1']]));
		vi.spyOn(kickDb, 'batchUpsertKickChannelsFromLivestreams').mockResolvedValue(
			new Map([['10', 'ch-1']])
		);
		vi.spyOn(kickDb, 'batchRecordKickLiveSamples').mockResolvedValue([
			{
				stream_session_id: 'sess',
				sampled_at: '2026-06-01T00:00:00Z',
				viewer_count: 50,
				platform: 'kick'
			}
		]);

		const runs: string[] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: () => ({
						run: async () => {
							runs.push(sql);
							return {};
						}
					})
				};
			},
			batch: async (statements: { run: () => Promise<unknown> }[]) => {
				for (const stmt of statements) {
					await stmt.run();
				}
				return [];
			}
		} as unknown as D1Database;

		const result = await runKickPollBatch(
			{
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				KICK_MIN_VIEWERS: '5',
				DB: db
			} as Env,
			['10', '11']
		);

		expect(result.liveStreams).toBe(1);
		expect(result.samplesWritten).toBe(1);
		expect(runs.some((s) => s.includes('last_seen_at'))).toBe(true);
	});

	it('skips samples when viewer_count is hidden', async () => {
		vi.spyOn(KickPublicApiClient.prototype, 'getLivestreamsByBroadcasterIds').mockResolvedValue([
			{
				broadcaster_user_id: 10,
				channel_id: 100,
				slug: 'ten',
				stream_title: 'T',
				started_at: '2026-06-01T00:00:00Z',
				viewer_count: null
			}
		]);
		vi.spyOn(kickDb, 'batchUpsertKickGameCategories').mockResolvedValue(new Map());
		vi.spyOn(kickDb, 'batchUpsertKickChannelsFromLivestreams').mockResolvedValue(
			new Map([['10', 'ch-1']])
		);
		const recordSpy = vi.spyOn(kickDb, 'batchRecordKickLiveSamples').mockResolvedValue([]);

		const db = {
			prepare: () => ({ bind: () => ({ run: async () => ({}) }) }),
			batch: async () => []
		} as unknown as D1Database;

		const result = await runKickPollBatch(
			{
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				DB: db
			} as Env,
			['10']
		);

		expect(result.liveStreams).toBe(1);
		expect(result.samplesWritten).toBe(0);
		expect(recordSpy).toHaveBeenCalledWith(expect.anything(), [], expect.anything());
	});
});
