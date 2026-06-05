import { describe, it, expect, vi, afterEach } from 'vitest';
import { YoutubeDataApiClient } from '../src/youtube/api';

describe('YoutubeDataApiClient', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getVideosByIds batches at 50 video IDs', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			expect(url).toContain('googleapis.com/youtube/v3/videos');
			expect(url).toContain('part=liveStreamingDetails%2Csnippet');
			expect(url).toContain('id=vid1');
			return Promise.resolve(
				new Response(
					JSON.stringify({
						items: [
							{
								id: 'vid1',
								snippet: {
									channelId: 'UC1',
									title: 'Live',
									liveBroadcastContent: 'live'
								},
								liveStreamingDetails: {
									actualStartTime: '2026-06-01T00:00:00Z',
									concurrentViewers: '42'
								}
							}
						]
					}),
					{ status: 200 }
				)
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'test-key' } as Env);
		const videos = await client.getVideosByIds(['vid1']);

		expect(videos).toHaveLength(1);
		expect(videos[0]?.id).toBe('vid1');
	});

	it('returns empty array for no video IDs', async () => {
		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		await expect(client.getVideosByIds([])).resolves.toEqual([]);
	});

	it('throws when API key missing', async () => {
		const client = new YoutubeDataApiClient({} as Env);
		await expect(client.getVideosByIds(['vid1'])).rejects.toThrow(/YOUTUBE_API_KEY/);
	});
});
