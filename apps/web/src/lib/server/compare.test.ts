import { describe, it, expect, vi } from 'vitest';
import {
	channelHasRollupMetrics,
	loadChannelCompare,
	parseCompareSlugs
} from './compare';
import { testLoadContext } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

describe('parseCompareSlugs', () => {
	it('normalizes empty to null', () => {
		expect(parseCompareSlugs(null, '  ')).toEqual({ a: null, b: null });
		expect(parseCompareSlugs('ninja', 'shroud')).toEqual({ a: 'ninja', b: 'shroud' });
	});
});

describe('channelHasRollupMetrics', () => {
	it('is false for not_found and discovered', () => {
		expect(
			channelHasRollupMetrics({
				source: 'not_found',
				platform: 'twitch',
				period: '7d',
				slug: 'x',
				displayName: 'x',
				avatarUrl: null,
				language: null,
				followerCount: null,
				description: null,
				trackedSince: null,
				ingestState: 'unknown',
				daily: [],
				totals: {
					hoursWatched: 0,
					averageViewers: 0,
					peakViewers: 0,
					airtimeHours: 0,
					streamCount: 0,
					followersGain: null
				}
			})
		).toBe(false);

		expect(
			channelHasRollupMetrics({
				source: 'live',
				platform: 'twitch',
				period: '7d',
				slug: 'x',
				displayName: 'x',
				avatarUrl: null,
				language: null,
				followerCount: null,
				description: null,
				trackedSince: null,
				ingestState: 'discovered',
				daily: [],
				totals: {
					hoursWatched: 0,
					averageViewers: 0,
					peakViewers: 0,
					airtimeHours: 0,
					streamCount: 0,
					followersGain: null
				}
			})
		).toBe(false);
	});

	it('is true when tracked channel has rollup totals', () => {
		expect(
			channelHasRollupMetrics({
				source: 'live',
				platform: 'twitch',
				period: '7d',
				slug: 'ninja',
				displayName: 'Ninja',
				avatarUrl: null,
				language: null,
				followerCount: null,
				description: null,
				trackedSince: null,
				ingestState: 'tracked',
				daily: [],
				totals: {
					hoursWatched: 10,
					averageViewers: 5,
					peakViewers: 20,
					airtimeHours: 2,
					streamCount: 1,
					followersGain: null
				}
			})
		).toBe(true);
	});
});

describe('loadChannelCompare', () => {
	it('loads both sides in parallel from ingest', async () => {
		const fetchFn = vi.fn().mockImplementation((input: string | URL) => {
			const url = String(input);
			const slug = url.includes('/ninja') ? 'ninja' : 'shroud';
			return Promise.resolve({
				ok: true,
				status: 200,
				json: async () => ({
					platform: 'twitch',
					slug,
					display_name: slug,
					avatar_url: null,
					tracked_since: '2026-01-01T00:00:00Z',
					ingest_state: 'tracked',
					follower_count: 100,
					description: null,
					language: 'en',
					period: '7d',
					totals: {
						hours_watched: 10,
						average_viewers: 5,
						peak_viewers: 20,
						airtime_hours: 2,
						stream_count: 1,
						followers_gain: null
					},
					daily: [{ date: '2026-06-01', hours_watched: 10, average_viewers: 5, peak_viewers: 20 }]
				})
			});
		});

		const load = await loadChannelCompare(testLoadContext(fetchFn as typeof fetch), {
			a: 'ninja',
			b: 'shroud',
			platform: 'twitch',
			period: '7d'
		});

		expect(load.a?.displayName).toBe('ninja');
		expect(load.b?.displayName).toBe('shroud');
		expect(load.a?.hasRollupMetrics).toBe(true);
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it('returns null sides when slugs omitted', async () => {
		const fetchFn = vi.fn();
		const load = await loadChannelCompare(testLoadContext(fetchFn as typeof fetch), {
			a: null,
			b: null,
			platform: 'twitch',
			period: '7d'
		});
		expect(load.a).toBeNull();
		expect(load.b).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('marks missing channel without rollup metrics', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		const load = await loadChannelCompare(testLoadContext(fetchFn as typeof fetch), {
			a: 'missing',
			b: null,
			platform: 'twitch',
			period: '30d'
		});
		expect(load.a?.source).toBe('not_found');
		expect(load.a?.hasRollupMetrics).toBe(false);
	});
});
