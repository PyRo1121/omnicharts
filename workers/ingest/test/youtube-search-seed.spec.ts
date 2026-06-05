import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv } from './helpers';
import * as seed from '../src/youtube/seed';
import { searchChannelsWithYoutubeSeed } from '../src/search/channels';

describe('searchChannelsWithYoutubeSeed', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns DB rows without calling YouTube API', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					all: async () => ({
						results: [
							{
								id: 'yt-1',
								slug: 'mrbeast',
								display_name: 'MrBeast',
								avatar_url: null,
								platform_id: 'youtube',
							},
						],
					}),
				}),
			}),
		};

		const seedSpy = vi.spyOn(seed, 'seedYoutubeChannelByQuery');
		const rows = await searchChannelsWithYoutubeSeed(db, testEnv(), {
			platformId: 'youtube',
			query: 'mrbeast',
		});

		expect(rows).toHaveLength(1);
		expect(seedSpy).not.toHaveBeenCalled();
	});

	it('seeds via forHandle when DB empty and query is exact handle', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					all: async () => ({ results: [] }),
				}),
			}),
		};

		vi.spyOn(seed, 'seedYoutubeChannelByQuery').mockResolvedValue({
			id: 'youtube-ch-UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
			display_name: 'MrBeast',
			avatar_url: 'https://example.com/a.jpg',
			platform_id: 'youtube',
		});

		const rows = await searchChannelsWithYoutubeSeed(db, testEnv(), {
			platformId: 'youtube',
			query: 'mrbeast',
		});

		expect(rows).toEqual([
			{
				id: 'youtube-ch-UCabcdefghijklmnopqrstuv',
				slug: 'mrbeast',
				display_name: 'MrBeast',
				avatar_url: 'https://example.com/a.jpg',
				platform_id: 'youtube',
			},
		]);
	});
});
