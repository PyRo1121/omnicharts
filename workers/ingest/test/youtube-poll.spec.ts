import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as youtubeDb from '../src/db/youtube-live-batch';
import { YoutubeDataApiClient } from '../src/youtube/api';
import { runYoutubeCatalogPoll, runYoutubePollBatch } from '../src/youtube/poll';

describe('youtube poll', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('runYoutubeCatalogPoll returns NEEDS_API when API key missing', async () => {
		const result = await runYoutubeCatalogPoll({} as Env);
		expect(result.skipped).toBe('NEEDS_API');
		expect(result.batches).toBe(0);
	});

	it('runYoutubePollBatch records samples for live videos above min viewers', async () => {
		vi.spyOn(YoutubeDataApiClient.prototype, 'getVideosByIds').mockResolvedValue([
			{
				id: 'vid-live',
				snippet: {
					channelId: 'UCabc',
					title: 'Live stream',
					liveBroadcastContent: 'live',
					categoryId: '20'
				},
				liveStreamingDetails: {
					actualStartTime: '2026-06-01T00:00:00Z',
					concurrentViewers: '120'
				}
			}
		]);
		vi.spyOn(youtubeDb, 'batchRecordYoutubeLiveSamples').mockResolvedValue([
			{
				stream_session_id: 'sess',
				sampled_at: '2026-06-01T00:00:00Z',
				viewer_count: 120,
				platform: 'youtube'
			}
		]);
		const clearSpy = vi.spyOn(youtubeDb, 'clearYoutubeLiveVideoIds').mockResolvedValue();

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

		const result = await runYoutubePollBatch(
			{
				YOUTUBE_API_KEY: 'key',
				YOUTUBE_MIN_VIEWERS: '5',
				DB: db
			} as Env,
			[{ channelRowId: 'ch-1', platformChannelId: 'UCabc', liveVideoId: 'vid-live' }]
		);

		expect(result.liveVideos).toBe(1);
		expect(result.samplesWritten).toBe(1);
		expect(clearSpy).not.toHaveBeenCalled();
		expect(runs.some((s) => s.includes('last_seen_at'))).toBe(true);
	});

	it('skips samples when concurrentViewers is hidden', async () => {
		vi.spyOn(YoutubeDataApiClient.prototype, 'getVideosByIds').mockResolvedValue([
			{
				id: 'vid-live',
				snippet: {
					channelId: 'UCabc',
					title: 'Live stream',
					liveBroadcastContent: 'live'
				},
				liveStreamingDetails: {
					actualStartTime: '2026-06-01T00:00:00Z'
				}
			}
		]);
		const recordSpy = vi.spyOn(youtubeDb, 'batchRecordYoutubeLiveSamples').mockResolvedValue([]);
		vi.spyOn(youtubeDb, 'clearYoutubeLiveVideoIds').mockResolvedValue();

		const db = {
			prepare: () => ({ bind: () => ({ run: async () => ({}) }) }),
			batch: async () => []
		} as unknown as D1Database;

		const result = await runYoutubePollBatch(
			{ YOUTUBE_API_KEY: 'key', DB: db } as Env,
			[{ channelRowId: 'ch-1', platformChannelId: 'UCabc', liveVideoId: 'vid-live' }]
		);

		expect(result.liveVideos).toBe(1);
		expect(result.samplesWritten).toBe(0);
		expect(recordSpy).toHaveBeenCalledWith(expect.anything(), [], expect.anything());
	});

	it('clears live video id and closes session when broadcast ended', async () => {
		vi.spyOn(YoutubeDataApiClient.prototype, 'getVideosByIds').mockResolvedValue([
			{
				id: 'vid-ended',
				snippet: {
					channelId: 'UCabc',
					title: 'Ended stream',
					liveBroadcastContent: 'none'
				},
				liveStreamingDetails: {
					actualStartTime: '2026-06-01T00:00:00Z',
					actualEndTime: '2026-06-01T02:00:00Z'
				}
			}
		]);
		vi.spyOn(youtubeDb, 'batchRecordYoutubeLiveSamples').mockResolvedValue([]);
		const clearSpy = vi.spyOn(youtubeDb, 'clearYoutubeLiveVideoIds').mockResolvedValue();

		const db = {
			prepare: () => ({ bind: () => ({ run: async () => ({}) }) }),
			batch: async () => []
		} as unknown as D1Database;

		await runYoutubePollBatch(
			{ YOUTUBE_API_KEY: 'key', DB: db } as Env,
			[{ channelRowId: 'ch-1', platformChannelId: 'UCabc', liveVideoId: 'vid-ended' }]
		);

		expect(clearSpy).toHaveBeenCalledWith(db, ['ch-1'], expect.anything());
	});

	it('refreshes live video id when initial lookup ended but channel still live', async () => {
		vi.spyOn(YoutubeDataApiClient.prototype, 'getVideosByIds').mockResolvedValue([
			{
				id: 'vid-ended',
				snippet: {
					channelId: 'UCabc',
					title: 'Ended',
					liveBroadcastContent: 'none'
				},
				liveStreamingDetails: {
					actualStartTime: '2026-06-01T00:00:00Z',
					actualEndTime: '2026-06-01T02:00:00Z'
				}
			}
		]);
		const resolveSpy = vi
			.spyOn(await import('../src/youtube/live-video-id'), 'resolveYoutubeLiveVideoId')
			.mockResolvedValue('vid-new-live');
		vi.spyOn(youtubeDb, 'batchRecordYoutubeLiveSamples').mockResolvedValue([]);
		vi.spyOn(youtubeDb, 'clearYoutubeLiveVideoIds').mockResolvedValue();

		const setCalls: string[] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => ({
						run: async () => {
							if (sql.includes('youtube_live_video_id')) {
								setCalls.push(String(args[1]));
							}
						}
					})
				};
			},
			batch: async () => []
		} as unknown as D1Database;

		await runYoutubePollBatch(
			{ YOUTUBE_API_KEY: 'key', DB: db } as Env,
			[{ channelRowId: 'ch-1', platformChannelId: 'UCabc', liveVideoId: 'vid-ended' }]
		);

		expect(resolveSpy).toHaveBeenCalled();
	});

	it('runYoutubePollBatch returns zero batches for empty targets', async () => {
		const result = await runYoutubePollBatch({ YOUTUBE_API_KEY: 'key', DB: {} as D1Database } as Env, []);
		expect(result).toEqual({ batches: 0, liveVideos: 0, samplesWritten: 0 });
	});

	it('skips samples below minViewers threshold', async () => {
		vi.spyOn(YoutubeDataApiClient.prototype, 'getVideosByIds').mockResolvedValue([
			{
				id: 'vid-live',
				snippet: { channelId: 'UCabc', title: 'Live', liveBroadcastContent: 'live' },
				liveStreamingDetails: {
					actualStartTime: '2026-06-01T00:00:00Z',
					concurrentViewers: '3'
				}
			}
		]);
		const recordSpy = vi.spyOn(youtubeDb, 'batchRecordYoutubeLiveSamples').mockResolvedValue([]);
		vi.spyOn(youtubeDb, 'clearYoutubeLiveVideoIds').mockResolvedValue();

		const db = {
			prepare: () => ({ bind: () => ({ run: async () => ({}) }) }),
			batch: async () => []
		} as unknown as D1Database;

		const result = await runYoutubePollBatch(
			{ YOUTUBE_API_KEY: 'key', YOUTUBE_MIN_VIEWERS: '5', DB: db } as Env,
			[{ channelRowId: 'ch-1', platformChannelId: 'UCabc', liveVideoId: 'vid-live' }]
		);

		expect(result.liveVideos).toBe(1);
		expect(result.samplesWritten).toBe(0);
		expect(recordSpy).toHaveBeenCalledWith(expect.anything(), [], expect.anything());
	});

	it('runYoutubeCatalogPoll batches tracked poll targets', async () => {
		vi.spyOn(await import('../src/db/youtube'), 'listYoutubeTrackedMissingLiveVideoId').mockResolvedValue(
			[]
		);
		vi.spyOn(await import('../src/db/youtube'), 'listYoutubePollTargets').mockResolvedValue([
			{ channelRowId: 'ch-1', platformChannelId: 'UCabc', liveVideoId: 'vid-1' }
		]);
		vi.spyOn(YoutubeDataApiClient.prototype, 'getVideosByIds').mockResolvedValue([
			{
				id: 'vid-1',
				snippet: { channelId: 'UCabc', title: 'Live', liveBroadcastContent: 'live' },
				liveStreamingDetails: {
					actualStartTime: '2026-06-01T00:00:00Z',
					concurrentViewers: '50'
				}
			}
		]);
		vi.spyOn(youtubeDb, 'batchRecordYoutubeLiveSamples').mockResolvedValue([
			{
				stream_session_id: 's',
				sampled_at: '2026-06-01T00:00:00Z',
				viewer_count: 50,
				platform: 'youtube'
			}
		]);
		vi.spyOn(youtubeDb, 'clearYoutubeLiveVideoIds').mockResolvedValue();
		vi.spyOn(await import('../src/r2/sample-archive'), 'archiveSampleBatch').mockResolvedValue();

		const db = {
			prepare: () => ({ bind: () => ({ run: async () => ({}) }) }),
			batch: async (stmts: { run: () => Promise<unknown> }[]) => {
				for (const s of stmts) await s.run();
				return [];
			}
		} as unknown as D1Database;

		const result = await runYoutubeCatalogPoll({
			YOUTUBE_API_KEY: 'key',
			YOUTUBE_MIN_VIEWERS: '5',
			DB: db
		} as Env);

		expect(result.batches).toBe(1);
		expect(result.samplesWritten).toBe(1);
		expect(result.skipped).toBeUndefined();
	});
});
