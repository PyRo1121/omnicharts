import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as seedModule from '../src/youtube/seed';
import * as resolve from '../src/youtube/resolve-channel';
import * as upsert from '../src/db/youtube-channel';

describe('youtube seed', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('youtubeSeedNeedsApiReason when key missing', () => {
		expect(seedModule.youtubeSeedNeedsApiReason({} as Env)).toMatch(/YOUTUBE_API_KEY/);
		expect(seedModule.youtubeSeedNeedsApiReason({ YOUTUBE_API_KEY: 'key' } as Env)).toBeNull();
	});

	it('seedYoutubeChannelByQuery returns null on NEEDS_API', async () => {
		const row = await seedModule.seedYoutubeChannelByQuery({} as Env, '@mrbeast');
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
		} as Awaited<ReturnType<typeof upsert.upsertYoutubeChannel>>);

		const db = {} as D1Database;
		const env = { YOUTUBE_API_KEY: 'key', DB: db } as Env;
		const row = await seedModule.seedYoutubeChannelByQuery(env, '@mrbeast');

		expect(row?.slug).toBe('mrbeast');
		expect(row?.platform_id).toBe('youtube');
	});

	it('seedYoutubeChannels counts all skipped when NEEDS_API', async () => {
		const stats = await seedModule.seedYoutubeChannels({} as Env, ['a', 'b']);
		expect(stats).toEqual({ seeded: 0, skipped: 2, errors: 0 });
	});

	it('seedYoutubeChannels counts errors when resolve throws', async () => {
		vi.spyOn(resolve, 'fetchYoutubeChannelByQuery').mockRejectedValue(new Error('api down'));
		const stats = await seedModule.seedYoutubeChannels({ YOUTUBE_API_KEY: 'key', DB: {} as D1Database } as Env, ['@fail']);
		expect(stats.errors).toBe(1);
		expect(stats.seeded).toBe(0);
	});
});
