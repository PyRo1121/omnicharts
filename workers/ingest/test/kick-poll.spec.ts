import { describe, it, expect, vi, beforeEach } from 'vitest';
import { noopBatchD1, pollBatchD1, testEnv } from './helpers';
import * as kickDb from '../src/db/kick-live-batch';
import { KickPublicApiClient } from '../src/kick/api';
import { runKickCatalogPoll, runKickPollBatch } from '../src/kick/poll';

describe('kick poll', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('runKickCatalogPoll returns NEEDS_API when credentials missing', async () => {
		const result = await runKickCatalogPoll(testEnv());
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
				category: { id: 7, name: 'IRL' },
			},
		]);
		vi.spyOn(kickDb, 'batchUpsertKickGameCategories').mockResolvedValue(new Map([['7', 'game-1']]));
		vi.spyOn(kickDb, 'batchUpsertKickChannelsFromLivestreams').mockResolvedValue(new Map([['10', 'ch-1']]));
		vi.spyOn(kickDb, 'batchRecordKickLiveSamples').mockResolvedValue([
			{
				stream_session_id: 'sess',
				sampled_at: '2026-06-01T00:00:00Z',
				viewer_count: 50,
				platform: 'kick',
			},
		]);

		const runs: string[] = [];
		const db = pollBatchD1((sql) => runs.push(sql));

		const result = await runKickPollBatch(
			testEnv({
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				KICK_MIN_VIEWERS: '5',
				DB: db,
			}),
			['10', '11'],
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
				viewer_count: null,
			},
		]);
		vi.spyOn(kickDb, 'batchUpsertKickGameCategories').mockResolvedValue(new Map());
		vi.spyOn(kickDb, 'batchUpsertKickChannelsFromLivestreams').mockResolvedValue(new Map([['10', 'ch-1']]));
		const recordSpy = vi.spyOn(kickDb, 'batchRecordKickLiveSamples').mockResolvedValue([]);

		const result = await runKickPollBatch(
			testEnv({
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				DB: noopBatchD1(),
			}),
			['10'],
		);

		expect(result.liveStreams).toBe(1);
		expect(result.samplesWritten).toBe(0);
		expect(recordSpy).toHaveBeenCalledWith(expect.anything(), [], expect.anything());
	});

	it('skips samples when viewer_count below minViewers threshold', async () => {
		vi.spyOn(KickPublicApiClient.prototype, 'getLivestreamsByBroadcasterIds').mockResolvedValue([
			{
				broadcaster_user_id: 10,
				channel_id: 100,
				slug: 'ten',
				stream_title: 'T',
				started_at: '2026-06-01T00:00:00Z',
				viewer_count: 3,
			},
		]);
		vi.spyOn(kickDb, 'batchUpsertKickGameCategories').mockResolvedValue(new Map());
		vi.spyOn(kickDb, 'batchUpsertKickChannelsFromLivestreams').mockResolvedValue(new Map([['10', 'ch-1']]));
		const recordSpy = vi.spyOn(kickDb, 'batchRecordKickLiveSamples').mockResolvedValue([]);

		const result = await runKickPollBatch(
			testEnv({
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				KICK_MIN_VIEWERS: '5',
				DB: noopBatchD1(),
			}),
			['10'],
		);

		expect(result.liveStreams).toBe(1);
		expect(result.samplesWritten).toBe(0);
		expect(recordSpy).toHaveBeenCalledWith(expect.anything(), [], expect.anything());
	});
});
