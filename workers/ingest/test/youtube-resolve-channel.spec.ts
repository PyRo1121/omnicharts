import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchYoutubeChannelByQuery } from '../src/youtube/resolve-channel';
import { YoutubeDataApiClient } from '../src/youtube/api';

describe('fetchYoutubeChannelByQuery', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('resolves handle via channels.list forHandle', async () => {
		vi.spyOn(YoutubeDataApiClient.prototype, 'getChannelByForHandle').mockResolvedValue({
			id: 'UCabcdefghijklmnopqrstuv',
			snippet: {
				title: 'MrBeast',
				customUrl: '@MrBeast',
				thumbnails: { default: { url: 'https://example.com/a.jpg' } },
			},
		});

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		const row = await fetchYoutubeChannelByQuery(client, 'mrbeast');

		expect(row).toEqual({
			platformChannelId: 'UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
			displayName: 'MrBeast',
			avatarUrl: 'https://example.com/a.jpg',
		});
	});

	it('resolves UC id via channels.list id=', async () => {
		vi.spyOn(YoutubeDataApiClient.prototype, 'getChannelsByIds').mockResolvedValue([
			{
				id: 'UCabcdefghijklmnopqrstuv',
				snippet: { title: 'MrBeast', customUrl: '@MrBeast' },
			},
		]);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		const row = await fetchYoutubeChannelByQuery(client, 'UCabcdefghijklmnopqrstuv');

		expect(row?.platformChannelId).toBe('UCabcdefghijklmnopqrstuv');
		expect(row?.slug).toBe('mrbeast');
	});

	it('returns null when API has no match', async () => {
		vi.spyOn(YoutubeDataApiClient.prototype, 'getChannelByForHandle').mockResolvedValue(null);

		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		await expect(fetchYoutubeChannelByQuery(client, 'unknown-channel-xyz')).resolves.toBeNull();
	});

	it('returns null for empty query without API call', async () => {
		const client = new YoutubeDataApiClient({ YOUTUBE_API_KEY: 'key' } as Env);
		const byId = vi.spyOn(YoutubeDataApiClient.prototype, 'getChannelsByIds');
		await expect(fetchYoutubeChannelByQuery(client, '   ')).resolves.toBeNull();
		expect(byId).not.toHaveBeenCalled();
	});
});
