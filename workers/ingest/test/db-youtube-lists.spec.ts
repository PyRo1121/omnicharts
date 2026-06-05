import { describe, it, expect } from 'vitest';
import { listYoutubePollTargets } from '../src/db/youtube';

describe('listYoutubePollTargets', () => {
	it('maps tracked channels with live video ids', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					all: async () => ({
						results: [
							{
								id: 'yt-ch-1',
								platform_channel_id: 'UCabc123',
								youtube_live_video_id: 'dQw4w9WgXcQ'
							}
						]
					})
				})
			})
		} as unknown as D1Database;

		const rows = await listYoutubePollTargets(db, 10);
		expect(rows).toEqual([
			{
				channelRowId: 'yt-ch-1',
				platformChannelId: 'UCabc123',
				liveVideoId: 'dQw4w9WgXcQ'
			}
		]);
	});
});
