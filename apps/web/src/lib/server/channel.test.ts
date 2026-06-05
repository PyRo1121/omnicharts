import { describe, it, expect, vi } from 'vitest';
import {
	findChannelOnOtherPlatforms,
	loadChannelDetail,
	parseChannelPeriod,
	resolveChannelSlugFromHistory
} from './channel';
import { testLoadContext } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

describe('loadChannelDetail', () => {
	it('parseChannelPeriod defaults to 7d', () => {
		expect(parseChannelPeriod(null)).toEqual({ period: '7d', periodNote: null });
		expect(parseChannelPeriod('30d')).toEqual({ period: '30d', periodNote: null });
	});

	it('parseChannelPeriod maps 90d to 30d with note', () => {
		expect(parseChannelPeriod('90d').period).toBe('30d');
		expect(parseChannelPeriod('90d').periodNote).toContain('90-day');
	});

	it('resolveChannelSlugFromHistory returns canonical slug', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ slug: 'newname', from_history: true })
		});
		const slug = await resolveChannelSlugFromHistory(testLoadContext(fetchFn as typeof fetch), 'oldname', 'twitch');
		expect(slug).toBe('newname');
	});

	it('maps live channel payload', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				platform: 'twitch',
				slug: 'ninja',
				display_name: 'Ninja',
				avatar_url: null,
				tracked_since: '2026-01-01T00:00:00Z',
				ingest_state: 'tracked',
				follower_count: 100,
				description: 'bio',
				language: 'en',
				period: '7d',
				totals: {
					hours_watched: 10,
					average_viewers: 5,
					peak_viewers: 20,
					airtime_hours: 2,
					stream_count: 3,
					followers_gain: 1
				},
				daily: [
					{ date: '2026-06-01', hours_watched: 4, average_viewers: 2, peak_viewers: 5 },
					{ date: '2026-06-02', hours_watched: 6, average_viewers: 3, peak_viewers: 8 }
				]
			})
		});

		const load = await loadChannelDetail(testLoadContext(fetchFn as typeof fetch), 'ninja', 'twitch', '7d');
		expect(load.source).toBe('live');
		expect(load.displayName).toBe('Ninja');
		expect(load.totals.hoursWatched).toBe(10);
		expect(load.daily).toHaveLength(2);
		expect(load.daily[0]?.hoursWatched).toBe(4);
	});

	it('returns not_found on 404', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		const load = await loadChannelDetail(testLoadContext(fetchFn as typeof fetch), 'missing', 'twitch', '7d');
		expect(load.source).toBe('not_found');
	});

	it('returns error on network failure', async () => {
		const fetchFn = vi.fn().mockRejectedValue(new Error('network'));
		const load = await loadChannelDetail(testLoadContext(fetchFn as typeof fetch), 'ninja', 'twitch', '7d');
		expect(load.source).toBe('error');
	});
});

describe('findChannelOnOtherPlatforms', () => {
	it('returns matches on platforms other than the requested tab', async () => {
		const fetchFn = vi.fn().mockImplementation((input: string | URL) => {
			const url = String(input);
			if (url.includes('/v1/channels/xqc?platform=kick')) {
				return Promise.resolve({
					ok: true,
					status: 200,
					json: async () => ({
						platform: 'kick',
						slug: 'xqc',
						display_name: 'xQc'
					})
				});
			}
			return Promise.resolve({ ok: false, status: 404 });
		});

		const suggestions = await findChannelOnOtherPlatforms(
			testLoadContext(fetchFn as typeof fetch),
			'xqc',
			'twitch'
		);
		expect(suggestions).toEqual([{ slug: 'xqc', platform: 'kick', displayName: 'xQc' }]);
	});
});
