import { describe, it, expect, vi } from 'vitest';
import { getTopTwitchGamesByAverageViewers } from '../src/ranking/top-games';
import * as rankingQueries from '../../../packages/rollup/src/ranking-queries';

describe('getTopTwitchGamesByAverageViewers', () => {
	it('maps query rows to ranked results', async () => {
		vi.spyOn(rankingQueries, 'queryTopGamesByAverageViewers').mockResolvedValue([
			{
				slug: 'valorant',
				name: 'VALORANT',
				hours_watched: 90000,
				average_viewers: 8000
			}
		]);

		const rows = await getTopTwitchGamesByAverageViewers({} as D1Database, {
			days: 7,
			limit: 5
		});

		expect(rows).toEqual([
			{
				rank: 1,
				slug: 'valorant',
				name: 'VALORANT',
				averageViewers: 8000,
				hoursWatched: 90000
			}
		]);
		vi.restoreAllMocks();
	});
});
