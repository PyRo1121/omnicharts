import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setYoutubeLiveVideoId } from '../src/db/youtube';
import {
	pickLiveVideoIdFromPlaylistItems,
	resolveYoutubeLiveVideoId
} from '../src/youtube/live-video-id';
import type { YoutubeDataApiClient } from '../src/youtube/api';
describe('pickLiveVideoIdFromPlaylistItems', () => {
	it('returns first live video id from uploads playlist page', () => {
		const id = pickLiveVideoIdFromPlaylistItems([
			{
				snippet: {
					resourceId: { videoId: 'vod123' },
					liveBroadcastContent: 'none'
				}
			},
			{
				snippet: {
					resourceId: { videoId: 'live456' },
					liveBroadcastContent: 'live'
				}
			}
		]);
		expect(id).toBe('live456');
	});

	it('returns null when no live item', () => {
		expect(
			pickLiveVideoIdFromPlaylistItems([
				{ snippet: { resourceId: { videoId: 'a' }, liveBroadcastContent: 'none' } }
			])
		).toBeNull();
	});
});

describe('resolveYoutubeLiveVideoId', () => {
	it('uses channels.list uploads playlist then playlistItems.list', async () => {
		const client = {
			getUploadsPlaylistId: vi.fn().mockResolvedValue('UU-uploads'),
			getPlaylistItems: vi.fn().mockResolvedValue([
				{
					snippet: {
						resourceId: { videoId: 'abcLive' },
						liveBroadcastContent: 'live'
					}
				}
			])
		} as unknown as YoutubeDataApiClient;

		const id = await resolveYoutubeLiveVideoId(client, 'UC-channel');
		expect(id).toBe('abcLive');
		expect(client.getUploadsPlaylistId).toHaveBeenCalledWith('UC-channel');
		expect(client.getPlaylistItems).toHaveBeenCalledWith('UU-uploads', 15);
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
						}
					})
				};
			}
		} as unknown as D1Database;

		await setYoutubeLiveVideoId(db, 'ch-row-1', 'video123');
		expect(binds[0]?.[0]).toContain('youtube_live_video_id');
		expect(binds[0]).toContain('video123');
	});
});
