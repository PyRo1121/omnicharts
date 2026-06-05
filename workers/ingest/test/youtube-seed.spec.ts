import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv, unusedIngestD1 } from './helpers';
import * as seedModule from '../src/youtube/seed';
import * as resolve from '../src/youtube/resolve-channel';
import * as upsert from '../src/db/youtube-channel';

describe('youtube seed', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('youtubeSeedNeedsApiReason when key missing', () => {
		expect(seedModule.youtubeSeedNeedsApiReason(testEnv())).toMatch(/YOUTUBE_API_KEY/);
		expect(seedModule.youtubeSeedNeedsApiReason(testEnv({ YOUTUBE_API_KEY: 'key' }))).toBeNull();
	});

	it('seedYoutubeChannelByQuery returns null on NEEDS_API', async () => {
		const row = await seedModule.seedYoutubeChannelByQuery(testEnv(), '@mrbeast');
		expect(row).toBeNull();
	});

	it('seedYoutubeChannelByQuery upserts resolved channel', async () => {
		vi.spyOn(resolve, 'fetchYoutubeChannelByQuery').mockResolvedValue({
			platformChannelId: 'UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
			displayName: 'MrBeast',
			avatarUrl: 'https://example.com/a.jpg',
		});
		vi.spyOn(upsert, 'upsertYoutubeChannel').mockResolvedValue({
			id: 'youtube-ch-UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
		});

		const db = unusedIngestD1();
		const env = testEnv({ YOUTUBE_API_KEY: 'key', DB: db });
		const row = await seedModule.seedYoutubeChannelByQuery(env, '@mrbeast');

		expect(row?.slug).toBe('mrbeast');
		expect(row?.platform_id).toBe('youtube');
	});

	it('seedYoutubeChannels counts all skipped when NEEDS_API', async () => {
		const stats = await seedModule.seedYoutubeChannels(testEnv(), ['a', 'b']);
		expect(stats).toEqual({ seeded: 0, skipped: 2, errors: 0 });
	});

	it('seedYoutubeChannels counts errors when resolve throws', async () => {
		vi.spyOn(resolve, 'fetchYoutubeChannelByQuery').mockRejectedValue(new Error('api down'));
		const stats = await seedModule.seedYoutubeChannels(testEnv({ YOUTUBE_API_KEY: 'key', DB: unusedIngestD1() }), ['@fail']);
		expect(stats.errors).toBe(1);
		expect(stats.seeded).toBe(0);
	});
});
