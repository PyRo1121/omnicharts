import { describe, it, expect, vi } from 'vitest';
import { testEnv } from './helpers';
import { setYoutubeLiveVideoId } from '../src/db/youtube';
import { pickLiveVideoIdFromPlaylistItems, resolveYoutubeLiveVideoId } from '../src/youtube/live-video-id';
import { YoutubeDataApiClient } from '../src/youtube/api';

describe('pickLiveVideoIdFromPlaylistItems', () => {
	it('returns first live video id from uploads playlist page', () => {
		const id = pickLiveVideoIdFromPlaylistItems([
			{
				snippet: {
					resourceId: { videoId: 'vod123' },
					liveBroadcastContent: 'none',
				},
			},
			{
				snippet: {
					resourceId: { videoId: 'live456' },
					liveBroadcastContent: 'live',
				},
			},
		]);
		expect(id).toBe('live456');
	});

	it('returns null when no live item', () => {
		expect(pickLiveVideoIdFromPlaylistItems([{ snippet: { resourceId: { videoId: 'a' }, liveBroadcastContent: 'none' } }])).toBeNull();
	});
});

describe('resolveYoutubeLiveVideoId', () => {
	it('uses channels.list uploads playlist then playlistItems.list', async () => {
		const getUploadsPlaylistId = vi.spyOn(YoutubeDataApiClient.prototype, 'getUploadsPlaylistId').mockResolvedValue('UU-uploads');
		const getPlaylistItems = vi.spyOn(YoutubeDataApiClient.prototype, 'getPlaylistItems').mockResolvedValue([
			{
				snippet: {
					resourceId: { videoId: 'abcLive' },
					liveBroadcastContent: 'live',
				},
			},
		]);
		const client = new YoutubeDataApiClient(testEnv({ YOUTUBE_API_KEY: 'key' }));

		const id = await resolveYoutubeLiveVideoId(client, 'UC-channel');
		expect(id).toBe('abcLive');
		expect(getUploadsPlaylistId).toHaveBeenCalledWith('UC-channel');
		expect(getPlaylistItems).toHaveBeenCalledWith('UU-uploads', 15);
		getUploadsPlaylistId.mockRestore();
		getPlaylistItems.mockRestore();
	});

	it('returns null when channel has no uploads playlist', async () => {
		const getUploadsPlaylistId = vi.spyOn(YoutubeDataApiClient.prototype, 'getUploadsPlaylistId').mockResolvedValue(null);
		const getPlaylistItems = vi.spyOn(YoutubeDataApiClient.prototype, 'getPlaylistItems');
		const client = new YoutubeDataApiClient(testEnv({ YOUTUBE_API_KEY: 'key' }));

		await expect(resolveYoutubeLiveVideoId(client, 'UC-channel')).resolves.toBeNull();
		expect(getPlaylistItems).not.toHaveBeenCalled();
		getUploadsPlaylistId.mockRestore();
		getPlaylistItems.mockRestore();
	});
});

describe('setYoutubeLiveVideoId', () => {
	it('updates channels.youtube_live_video_id for YouTube row', async () => {
		const binds: unknown[][] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => ({
						run: async () => {
							binds.push([sql, ...args]);
						},
					}),
				};
			},
		};

		await setYoutubeLiveVideoId(db, 'ch-row-1', 'video123');
		expect(binds[0]?.[0]).toContain('youtube_live_video_id');
		expect(binds[0]).toContain('video123');
	});
});
