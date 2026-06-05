import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	fetchAllArchiveVideosForUser,
	runTwitchVodBackfill
} from '../src/twitch/vod-backfill';
import { TwitchHelixClient, type HelixVideo } from '../src/twitch/helix';
import * as vodSessions from '../src/db/vod-sessions';

const sampleVideo = (overrides: Partial<HelixVideo> = {}): HelixVideo => ({
	id: '987654321',
	user_id: '545050196',
	user_login: 'katojunichi',
	user_name: 'KatoJunichi',
	title: 'VOD title',
	description: '',
	created_at: '2026-06-01T10:00:00.000Z',
	published_at: '2026-06-01T10:05:00.000Z',
	url: 'https://www.twitch.tv/videos/987654321',
	thumbnail_url: 'https://static-cdn.jtvnw.net/thumb.jpg',
	viewable: 'public',
	view_count: 1200,
	language: 'en',
	type: 'archive',
	duration: 'PT2H',
	...overrides
});

describe('fetchAllArchiveVideosForUser', () => {
	it('returns empty list when Helix has no VODs', async () => {
		const client = {
			getArchiveVideosPage: vi.fn().mockResolvedValue({ data: [] })
		} as unknown as TwitchHelixClient;

		const result = await fetchAllArchiveVideosForUser(client, '123');
		expect(result.videos).toEqual([]);
		expect(result.pages).toBe(1);
	});

	it('follows pagination until cursor exhausted', async () => {
		const client = {
			getArchiveVideosPage: vi
				.fn()
				.mockResolvedValueOnce({
					data: [sampleVideo({ id: '1' })],
					pagination: { cursor: 'next' }
				})
				.mockResolvedValueOnce({
					data: [sampleVideo({ id: '2' })],
					pagination: {}
				})
		} as unknown as TwitchHelixClient;

		const result = await fetchAllArchiveVideosForUser(client, '123', { first: 1 });
		expect(result.videos.map((v) => v.id)).toEqual(['1', '2']);
		expect(result.pages).toBe(2);
	});
});

describe('runTwitchVodBackfill', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns NEEDS_API when Twitch credentials missing', async () => {
		const stats = await runTwitchVodBackfill({ DB: {} as D1Database } as Env);
		expect(stats.skipped).toBe('NEEDS_API');
		expect(stats.ok).toBe(false);
	});

	it('processes tracked channel with empty VOD list', async () => {
		vi.spyOn(vodSessions, 'listChannelsForVodBackfill').mockResolvedValue([
			{
				id: 'twitch-ch-1',
				platform_channel_id: '111',
				broadcaster_type: 'affiliate'
			}
		]);
		vi.spyOn(vodSessions, 'batchUpsertVodSessions').mockResolvedValue(0);
		vi.spyOn(vodSessions, 'markChannelsVodBackfilled').mockResolvedValue();
		vi.spyOn(TwitchHelixClient.prototype, 'getArchiveVideosPage').mockResolvedValue({
			data: []
		});

		const stats = await runTwitchVodBackfill(
			{
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'secret',
				DB: {} as D1Database
			} as Env,
			{ limit: 1 }
		);

		expect(stats.channels_processed).toBe(1);
		expect(stats.videos_fetched).toBe(0);
		expect(stats.sessions_upserted).toBe(0);
		expect(vodSessions.markChannelsVodBackfilled).toHaveBeenCalledWith(
			expect.anything(),
			['twitch-ch-1']
		);
	});

	it('upserts in-window VOD metadata for partner tier', async () => {
		vi.spyOn(vodSessions, 'listChannelsForVodBackfill').mockResolvedValue([
			{
				id: 'twitch-ch-2',
				platform_channel_id: '222',
				broadcaster_type: 'partner'
			}
		]);
		const upsert = vi.spyOn(vodSessions, 'batchUpsertVodSessions').mockResolvedValue(1);
		vi.spyOn(vodSessions, 'markChannelsVodBackfilled').mockResolvedValue();

		const recent = sampleVideo({
			published_at: '2026-06-04T00:00:00.000Z',
			created_at: '2026-06-04T00:00:00.000Z'
		});
		const stale = sampleVideo({
			id: 'old',
			published_at: '2026-01-01T00:00:00.000Z',
			created_at: '2026-01-01T00:00:00.000Z'
		});

		vi.spyOn(TwitchHelixClient.prototype, 'getArchiveVideosPage').mockResolvedValue({
			data: [recent, stale]
		});

		const stats = await runTwitchVodBackfill(
			{
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'secret',
				DB: {} as D1Database
			} as Env,
			{ limit: 1 }
		);

		expect(stats.sessions_upserted).toBe(1);
		expect(upsert).toHaveBeenCalledWith(
			expect.anything(),
			expect.arrayContaining([
				expect.objectContaining({
					channel_id: 'twitch-ch-2',
					platform_stream_id: recent.id,
					duration: 'PT2H'
				})
			])
		);
	});

	it('retries through Helix 429 when fetching VOD pages', async () => {
		vi.spyOn(vodSessions, 'listChannelsForVodBackfillByPlatformIds').mockResolvedValue([
			{
				id: 'twitch-ch-3',
				platform_channel_id: '333',
				broadcaster_type: null
			}
		]);
		vi.spyOn(vodSessions, 'batchUpsertVodSessions').mockResolvedValue(1);
		vi.spyOn(vodSessions, 'markChannelsVodBackfilled').mockResolvedValue();

		const getPage = vi
			.spyOn(TwitchHelixClient.prototype, 'getArchiveVideosPage')
			.mockRejectedValueOnce(new Error('Helix /videos rate limited after 0 retries'))
			.mockResolvedValueOnce({ data: [sampleVideo()] });

		await expect(
			runTwitchVodBackfill(
				{
					TWITCH_CLIENT_ID: 'id',
					TWITCH_CLIENT_SECRET: 'secret',
					DB: {} as D1Database
				} as Env,
				{ platformChannelIds: ['333'] }
			)
		).rejects.toThrow(/rate limited/);

		getPage.mockReset();
		getPage
			.mockResolvedValueOnce({ data: [sampleVideo()] });

		const stats = await runTwitchVodBackfill(
			{
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'secret',
				DB: {} as D1Database
			} as Env,
			{ platformChannelIds: ['333'] }
		);
		expect(stats.channels_processed).toBe(1);
	});
});
