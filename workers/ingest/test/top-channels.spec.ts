import { describe, it, expect, vi } from 'vitest';
import * as rankingQueries from '../../../packages/rollup/src/ranking-queries';
import { getTopTwitchChannelsByHoursWatched } from '../src/ranking/top-channels';

describe('getTopTwitchChannelsByHoursWatched', () => {
	it('sorts SQL results with tie-break rules', async () => {
		vi.spyOn(rankingQueries, 'queryTopChannelsByHoursWatched').mockResolvedValue([
			{
				slug: 'b-stream',
				display_name: 'B',
				avatar_url: null,
				first_observed_at: '2026-01-01T00:00:00.000Z',
				hours_watched: 100,
				average_viewers: 10,
				airtime_minutes: 120,
			},
			{
				slug: 'a-stream',
				display_name: 'A',
				avatar_url: 'https://example.com/a.png',
				first_observed_at: '2026-01-02T00:00:00.000Z',
				hours_watched: 100,
				average_viewers: 20,
				airtime_minutes: 120,
			},
		]);

		const rankings = await getTopTwitchChannelsByHoursWatched({} as D1Database, {
			days: 7,
			limit: 20,
		});

		expect(rankings[0].slug).toBe('a-stream');
		expect(rankings[0].rank).toBe(1);
		expect(rankings[0].avatarUrl).toContain('example.com');
		vi.restoreAllMocks();
	});
});
