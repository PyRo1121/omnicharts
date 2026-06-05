import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as helixModule from '../src/twitch/helix';
import * as kickApiModule from '../src/kick/api';
import * as youtubeSeedModule from '../src/youtube/seed';
import * as watchlistUpsert from '../src/watchlist/upsert';
import { importWatchlistCsv, importWatchlistRows } from '../src/watchlist/import';

const dbStub = {} as D1Database;

describe('importWatchlistRows', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns NEEDS_API for twitch rows when credentials missing', async () => {
		const stats = await importWatchlistRows(
			{ DB: dbStub } as Env,
			[{ line: 2, platform: 'twitch', slug: 'ninja' }]
		);

		expect(stats.needs_api).toMatch(/TWITCH/);
		expect(stats.results[0]?.status).toBe('needs_api');
		expect(stats.imported).toBe(0);
	});

	it('imports twitch channel via Helix login lookup', async () => {
		vi.spyOn(helixModule.TwitchHelixClient.prototype, 'getUsersByLogins').mockResolvedValue([
			{
				id: '123',
				login: 'ninja',
				display_name: 'Ninja',
				type: '',
				broadcaster_type: 'partner',
				description: '',
				profile_image_url: 'https://example.com/ninja.jpg',
				created_at: '2011-01-01T00:00:00Z'
			}
		]);
		vi.spyOn(watchlistUpsert, 'upsertTwitchChannelFromUser').mockResolvedValue({
			channelId: 'twitch-ch-123',
			created: true,
			promoted: false,
			skipped: false
		});

		const stats = await importWatchlistRows(
			{
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env,
			[{ line: 2, platform: 'twitch', slug: 'ninja' }]
		);

		expect(stats.imported).toBe(1);
		expect(stats.results[0]?.status).toBe('imported');
	});

	it('promotes existing discovered twitch channel', async () => {
		vi.spyOn(helixModule.TwitchHelixClient.prototype, 'getUsersByLogins').mockResolvedValue([
			{
				id: '123',
				login: 'ninja',
				display_name: 'Ninja',
				type: '',
				broadcaster_type: 'partner',
				description: '',
				profile_image_url: 'https://example.com/ninja.jpg',
				created_at: '2011-01-01T00:00:00Z'
			}
		]);
		vi.spyOn(watchlistUpsert, 'upsertTwitchChannelFromUser').mockResolvedValue({
			channelId: 'twitch-ch-123',
			created: false,
			promoted: true,
			skipped: false
		});

		const stats = await importWatchlistRows(
			{
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env,
			[{ line: 2, platform: 'twitch', slug: 'ninja' }]
		);

		expect(stats.promoted).toBe(1);
		expect(stats.results[0]?.status).toBe('promoted');
	});

	it('skips already tracked twitch channel', async () => {
		vi.spyOn(helixModule.TwitchHelixClient.prototype, 'getUsersByLogins').mockResolvedValue([
			{
				id: '123',
				login: 'ninja',
				display_name: 'Ninja',
				type: '',
				broadcaster_type: 'partner',
				description: '',
				profile_image_url: 'https://example.com/ninja.jpg',
				created_at: '2011-01-01T00:00:00Z'
			}
		]);
		vi.spyOn(watchlistUpsert, 'upsertTwitchChannelFromUser').mockResolvedValue({
			channelId: 'twitch-ch-123',
			created: false,
			promoted: false,
			skipped: true
		});

		const stats = await importWatchlistRows(
			{
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env,
			[{ line: 2, platform: 'twitch', slug: 'ninja' }]
		);

		expect(stats.skipped_rows).toBe(1);
		expect(stats.results[0]?.status).toBe('skipped');
	});

	it('returns not_found when Helix has no user', async () => {
		vi.spyOn(helixModule.TwitchHelixClient.prototype, 'getUsersByLogins').mockResolvedValue([]);

		const stats = await importWatchlistRows(
			{
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env,
			[{ line: 2, platform: 'twitch', slug: 'missing-user' }]
		);

		expect(stats.not_found).toBe(1);
		expect(stats.results[0]?.status).toBe('not_found');
	});

	it('returns NEEDS_API for youtube when key missing', async () => {
		const stats = await importWatchlistRows(
			{ DB: dbStub } as Env,
			[{ line: 2, platform: 'youtube', slug: 'mrbeast' }]
		);

		expect(stats.results[0]?.status).toBe('needs_api');
	});

	it('imports youtube channel via seed path', async () => {
		vi.spyOn(youtubeSeedModule, 'seedYoutubeChannelByQuery').mockResolvedValue({
			id: 'youtube-ch-UCabc',
			slug: 'mrbeast',
			display_name: 'MrBeast',
			avatar_url: null,
			platform_id: 'youtube'
		});

		const youtubeDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => null
				})
			})
		} as unknown as D1Database;

		const stats = await importWatchlistRows(
			{ YOUTUBE_API_KEY: 'key', DB: youtubeDb } as Env,
			[{ line: 2, platform: 'youtube', slug: 'mrbeast' }]
		);

		expect(stats.imported).toBe(1);
		expect(youtubeSeedModule.seedYoutubeChannelByQuery).toHaveBeenCalledWith(
			expect.anything(),
			'mrbeast',
			expect.objectContaining({ promoteToTracked: true })
		);
	});

	it('skips tracked youtube channel without seeding', async () => {
		const youtubeDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({ id: 'youtube-ch-1', ingest_state: 'tracked' })
				})
			})
		} as unknown as D1Database;

		const stats = await importWatchlistRows(
			{ YOUTUBE_API_KEY: 'key', DB: youtubeDb } as Env,
			[{ line: 2, platform: 'youtube', slug: 'mrbeast' }]
		);

		expect(stats.skipped_rows).toBe(1);
		expect(stats.results[0]?.status).toBe('skipped');
	});

	it('promotes discovered youtube channel', async () => {
		vi.spyOn(youtubeSeedModule, 'seedYoutubeChannelByQuery').mockResolvedValue({
			id: 'youtube-ch-UCabc',
			slug: 'mrbeast',
			display_name: 'MrBeast',
			avatar_url: null,
			platform_id: 'youtube'
		});

		const youtubeDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({ id: 'youtube-ch-UCabc', ingest_state: 'discovered' })
				})
			})
		} as unknown as D1Database;

		const stats = await importWatchlistRows(
			{ YOUTUBE_API_KEY: 'key', DB: youtubeDb } as Env,
			[{ line: 2, platform: 'youtube', slug: 'mrbeast' }]
		);

		expect(stats.promoted).toBe(1);
	});

	it('returns not_found when youtube seed misses', async () => {
		vi.spyOn(youtubeSeedModule, 'seedYoutubeChannelByQuery').mockResolvedValue(null);

		const youtubeDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => null
				})
			})
		} as unknown as D1Database;

		const stats = await importWatchlistRows(
			{ YOUTUBE_API_KEY: 'key', DB: youtubeDb } as Env,
			[{ line: 2, platform: 'youtube', slug: 'missing' }]
		);

		expect(stats.not_found).toBe(1);
	});

	it('returns error when youtube import throws', async () => {
		vi.spyOn(youtubeSeedModule, 'seedYoutubeChannelByQuery').mockRejectedValue(
			new Error('youtube down')
		);

		const youtubeDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => null
				})
			})
		} as unknown as D1Database;

		const stats = await importWatchlistRows(
			{ YOUTUBE_API_KEY: 'key', DB: youtubeDb } as Env,
			[{ line: 2, platform: 'youtube', slug: 'mrbeast' }]
		);

		expect(stats.errors).toBe(1);
		expect(stats.results[0]?.status).toBe('error');
	});

	it('returns error when kick import throws', async () => {
		vi.spyOn(kickApiModule.KickPublicApiClient.prototype, 'getChannelsBySlug').mockRejectedValue(
			new Error('kick down')
		);

		const stats = await importWatchlistRows(
			{
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env,
			[{ line: 2, platform: 'kick', slug: 'xqc' }]
		);

		expect(stats.errors).toBe(1);
		expect(stats.results[0]?.status).toBe('error');
	});

	it('returns not_found when kick channel missing', async () => {
		vi.spyOn(kickApiModule.KickPublicApiClient.prototype, 'getChannelsBySlug').mockResolvedValue(
			[]
		);

		const stats = await importWatchlistRows(
			{
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env,
			[{ line: 2, platform: 'kick', slug: 'missing' }]
		);

		expect(stats.not_found).toBe(1);
	});

	it('returns error when twitch import throws', async () => {
		vi.spyOn(helixModule.TwitchHelixClient.prototype, 'getUsersByLogins').mockRejectedValue(
			new Error('helix down')
		);

		const stats = await importWatchlistRows(
			{
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env,
			[{ line: 2, platform: 'twitch', slug: 'ninja' }]
		);

		expect(stats.errors).toBe(1);
		expect(stats.results[0]?.status).toBe('error');
	});

	it('importWatchlistCsv returns parse stats for empty valid rows', async () => {
		const stats = await importWatchlistCsv(
			{ DB: dbStub } as Env,
			'platform,slug\nfacebook,foo'
		);

		expect(stats.parse.rows).toEqual([]);
		expect(stats.parse.errors.length).toBeGreaterThan(0);
	});

	it('imports kick channel via slug resolve', async () => {
		vi.spyOn(kickApiModule.KickPublicApiClient.prototype, 'getChannelsBySlug').mockResolvedValue([
			{
				broadcaster_user_id: 99,
				channel_id: 1,
				slug: 'xqc',
				stream_title: 'live'
			}
		]);

		vi.spyOn(watchlistUpsert, 'upsertKickChannelFromLookup').mockResolvedValue({
			channelId: 'kick-ch-99',
			created: true,
			promoted: false,
			skipped: false
		});

		const stats = await importWatchlistRows(
			{
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env,
			[{ line: 2, platform: 'kick', slug: 'xqc' }]
		);

		expect(stats.imported).toBe(1);
		expect(stats.results[0]?.status).toBe('imported');
	});
});
