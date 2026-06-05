import { describe, it, expect, vi, afterEach } from 'vitest';
import * as topGames from '../src/top-games';
import { buildRankingsGamesResponse, parseRankingsGamesQuery } from '../src/games-api';
import { unusedMockD1 } from './mock-d1';

describe('parseRankingsGamesQuery', () => {
	it('defaults platform twitch and period 7d', () => {
		const url = new URL('http://x/v1/rankings/games');
		const q = parseRankingsGamesQuery(url);
		expect(q.ok).toBe(true);
		if (!q.ok) return;
		expect(q.platform).toBe('twitch');
		expect(q.period).toBe('7d');
		expect(q.limit).toBe(20);
	});

	it('accepts platform=kick', () => {
		const url = new URL('http://x/v1/rankings/games?platform=kick');
		const q = parseRankingsGamesQuery(url);
		expect(q.ok).toBe(true);
		if (!q.ok) return;
		expect(q.platform).toBe('kick');
	});

	it('rejects invalid period', () => {
		const url = new URL('http://x/v1/rankings/games?period=365d');
		expect(parseRankingsGamesQuery(url)).toEqual({ ok: false, error: 'invalid_period' });
	});
});

describe('buildRankingsGamesResponse', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('queries kick rollups via platform-agnostic top games', async () => {
		const spy = vi.spyOn(topGames, 'getTopGamesByAverageViewers').mockResolvedValue([
			{
				rank: 1,
				slug: 'just-chatting',
				name: 'Just Chatting',
				averageViewers: 8500.2,
				hoursWatched: 120000,
			},
		]);

		const db = unusedMockD1();

		const res = await buildRankingsGamesResponse(db, {
			platform: 'kick',
			period: '7d',
			limit: 20,
		});

		expect(spy).toHaveBeenCalledWith(db, expect.objectContaining({ platformId: 'kick', days: 7, limit: 20 }));
		expect(res.platform).toBe('kick');
		expect(res.items[0]).toMatchObject({
			rank: 1,
			slug: 'just-chatting',
			name: 'Just Chatting',
			average_viewers: 8500,
			hours_watched: 120000,
		});
	});

	it('uses platform-specific min viewers from env', async () => {
		const spy = vi.spyOn(topGames, 'getTopGamesByAverageViewers').mockResolvedValue([]);

		const db = unusedMockD1();

		await buildRankingsGamesResponse(
			db,
			{ platform: 'youtube', period: '7d', limit: 20 },
			{ YOUTUBE_MIN_VIEWERS: 30, TWITCH_MIN_VIEWERS: 2 },
		);

		expect(spy).toHaveBeenCalledWith(db, expect.objectContaining({ platformId: 'youtube', minAverageViewers: 30 }));
	});

	it('returns empty items for youtube when no rollups', async () => {
		vi.spyOn(topGames, 'getTopGamesByAverageViewers').mockResolvedValue([]);

		const db = unusedMockD1();

		const res = await buildRankingsGamesResponse(db, {
			platform: 'youtube',
			period: '7d',
			limit: 20,
		});

		expect(res.platform).toBe('youtube');
		expect(res.items).toEqual([]);
	});

	it('maps twitch game rankings to API shape sorted by AV', async () => {
		vi.spyOn(topGames, 'getTopGamesByAverageViewers').mockResolvedValue([
			{
				rank: 1,
				slug: 'league-of-legends',
				name: 'League of Legends',
				averageViewers: 12000.7,
				hoursWatched: 500000,
			},
		]);

		const db = unusedMockD1();

		const res = await buildRankingsGamesResponse(db, {
			platform: 'twitch',
			period: '30d',
			limit: 10,
		});

		expect(res.period).toBe('30d');
		expect(res.items[0]).toMatchObject({
			rank: 1,
			slug: 'league-of-legends',
			name: 'League of Legends',
			average_viewers: 12001,
			hours_watched: 500000,
		});
	});
});
