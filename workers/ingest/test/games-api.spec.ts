import { describe, it, expect, vi } from 'vitest';
import { unusedIngestD1 } from './helpers';
import * as rankingQueries from '../../../packages/rollup/src/ranking-queries';
import { buildRankingsGamesResponse, parseRankingsGamesQuery } from '../src/ranking/games-api';

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

	it('rejects invalid period', () => {
		const url = new URL('http://x/v1/rankings/games?period=365d');
		expect(parseRankingsGamesQuery(url)).toEqual({ ok: false, error: 'invalid_period' });
	});
});

describe('buildRankingsGamesResponse', () => {
	it('queries kick game rollups when platform=kick', async () => {
		const spy = vi.spyOn(rankingQueries, 'queryTopGamesByAverageViewers').mockResolvedValue([
			{
				slug: 'just-chatting',
				name: 'Just Chatting',
				hours_watched: 120000,
				average_viewers: 8500,
			},
		]);

		const res = await buildRankingsGamesResponse(unusedIngestD1(), {
			platform: 'kick',
			period: '7d',
			limit: 20,
		});

		expect(spy).toHaveBeenCalledWith({}, expect.objectContaining({ platformId: 'kick', days: 7, limit: 20 }));
		expect(res.platform).toBe('kick');
		expect(res.items[0]).toMatchObject({
			rank: 1,
			slug: 'just-chatting',
			name: 'Just Chatting',
			average_viewers: 8500,
			hours_watched: 120000,
		});
		vi.restoreAllMocks();
	});

	it('returns empty items for youtube when no rollups', async () => {
		vi.spyOn(rankingQueries, 'queryTopGamesByAverageViewers').mockResolvedValue([]);
		const res = await buildRankingsGamesResponse(unusedIngestD1(), {
			platform: 'youtube',
			period: '7d',
			limit: 20,
		});
		expect(res.items).toEqual([]);
		vi.restoreAllMocks();
	});

	it('maps twitch game rankings to API shape sorted by AV', async () => {
		vi.spyOn(rankingQueries, 'queryTopGamesByAverageViewers').mockResolvedValue([
			{
				slug: 'league-of-legends',
				name: 'League of Legends',
				hours_watched: 500000,
				average_viewers: 12000.7,
			},
		]);

		const res = await buildRankingsGamesResponse(unusedIngestD1(), {
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
		vi.restoreAllMocks();
	});
});
