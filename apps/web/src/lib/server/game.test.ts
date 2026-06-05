import { describe, it, expect, vi } from 'vitest';
import { loadGameDetail, parseGamePeriod } from './game';
import { testLoadContext } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

describe('loadGameDetail', () => {
	it('parseGamePeriod defaults to 7d', () => {
		expect(parseGamePeriod('invalid')).toEqual({ period: '7d', periodNote: null });
		expect(parseGamePeriod('90d').period).toBe('30d');
		expect(parseGamePeriod('90d').periodNote).toContain('90-day');
	});

	it('maps live game payload', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				platform: 'twitch',
				slug: 'valorant',
				name: 'VALORANT',
				period: '7d',
				totals: {
					hours_watched: 100,
					average_viewers: 50,
					peak_viewers: 200,
					airtime_hours: 10,
					live_channels: 5
				},
				daily: [
					{ date: '2026-05-27', hours_watched: 40, average_viewers: 20, peak_viewers: 80 },
					{ date: '2026-05-28', hours_watched: 60, average_viewers: 30, peak_viewers: 120 }
				],
				top_channels: [
					{
						rank: 1,
						slug: 'shroud',
						display_name: 'shroud',
						avatar_url: 'https://example/a.png',
						hours_watched: 4200
					}
				]
			})
		});

		const load = await loadGameDetail(testLoadContext(fetchFn as typeof fetch), 'valorant', 'twitch', '7d');
		expect(load.source).toBe('live');
		expect(load.name).toBe('VALORANT');
		expect(load.totals.liveChannels).toBe(5);
		expect(load.daily).toHaveLength(2);
		expect(load.topChannels).toEqual([
			{
				rank: 1,
				slug: 'shroud',
				displayName: 'shroud',
				avatarUrl: 'https://example/a.png',
				hoursWatched: '4.2K'
			}
		]);
	});

	it('returns not_found on 404', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		const load = await loadGameDetail(testLoadContext(fetchFn as typeof fetch), 'missing', 'twitch', '7d');
		expect(load.source).toBe('not_found');
	});
});
