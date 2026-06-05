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

	it('getChannelByForHandle calls channels.list forHandle', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{
							id: 'UCabcdefghijklmnopqrstuv',
							snippet: { title: 'MrBeast', customUrl: '@MrBeast' }
						}
					]
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'test-key' } as Env);
		const channel = await client.getChannelByForHandle('mrbeast');

		expect(channel?.id).toBe('UCabcdefghijklmnopqrstuv');
		const url = String(fetchMock.mock.calls[0]?.[0]);
		expect(url).toContain('forHandle=mrbeast');
		expect(url).toContain('part=id%2Csnippet');
	});

	it('getChannelByForHandle returns null for empty handle', async () => {
		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		await expect(client.getChannelByForHandle('   ')).resolves.toBeNull();
	});

	it('getChannelsByIds returns items from channels.list', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [{ id: 'UC1', snippet: { title: 'One' } }]
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		const channels = await client.getChannelsByIds(['UC1']);
		expect(channels).toHaveLength(1);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain('id=UC1');
	});

	it('getUploadsPlaylistId reads contentDetails.relatedPlaylists.uploads', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{
							contentDetails: { relatedPlaylists: { uploads: 'UUuploads123' } }
						}
					]
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		await expect(client.getUploadsPlaylistId('UCabc')).resolves.toBe('UUuploads123');
	});

	it('getPlaylistItems calls playlistItems.list', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [{ snippet: { resourceId: { videoId: 'vid1' } } }]
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		const items = await client.getPlaylistItems('UUuploads123', 5);
		expect(items).toHaveLength(1);
		const url = String(fetchMock.mock.calls[0]?.[0]);
		expect(url).toContain('playlistItems');
		expect(url).toContain('maxResults=5');
	});

	it('throws on videos.list HTTP error', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('quota exceeded', { status: 429 }));
		vi.stubGlobal('fetch', fetchMock);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		await expect(client.getVideosByIds(['vid1'])).rejects.toThrow(/429/);
	});

	it('getUploadsPlaylistId returns null when uploads playlist missing', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ items: [{ contentDetails: { relatedPlaylists: {} } }] }), {
				status: 200
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		await expect(client.getUploadsPlaylistId('UCabc')).resolves.toBeNull();
	});

	it('throws on channels.list HTTP error', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }));
		vi.stubGlobal('fetch', fetchMock);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		await expect(client.getChannelsByIds(['UC1'])).rejects.toThrow(/400/);
	});
});
