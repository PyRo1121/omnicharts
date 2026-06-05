import { describe, it, expect, vi } from 'vitest';
import { enrichSearchResultsWithRollups, searchChannels } from './search';
import { testLoadContext } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

describe('searchChannels', () => {
	it('passes platform=kick to ingest search (docs/16)', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ results: [] })
		});

		await searchChannels(fetchFn as typeof fetch, { q: 'xqc', platform: 'kick', limit: 25 });

		expect(fetchFn).toHaveBeenCalledOnce();
		const url = String(fetchFn.mock.calls[0]?.[0]);
		expect(url).toContain('/v1/search/channels');
		expect(url).toContain('platform=kick');
		expect(url).toContain('q=xqc');
	});

	it('returns kick rows without rollup enrichment', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				results: [
					{
						id: '1',
						slug: 'xqc',
						display_name: 'xQc',
						avatar_url: null,
						platform_id: 'kick'
					}
				]
			})
		});

		const { results, error } = await searchChannels(fetchFn as typeof fetch, {
			q: 'xqc',
			platform: 'kick'
		});

		expect(error).toBe(false);
		expect(results[0]).toMatchObject({
			slug: 'xqc',
			displayName: 'xQc',
			platform: 'kick',
			hoursWatched7d: null
		});
	});
});

describe('enrichSearchResultsWithRollups', () => {
	const kickRow = {
		id: '1',
		slug: 'xqc',
		displayName: 'xQc',
		avatarUrl: null,
		platform: 'kick',
		hoursWatched7d: null
	};

	function channelDetailBody(platform: string, hoursWatched: number) {
		return {
			platform,
			slug: 'xqc',
			display_name: 'xQc',
			avatar_url: null,
			tracked_since: '2026-01-01T00:00:00Z',
			ingest_state: 'tracked',
			follower_count: 100,
			description: null,
			period: '7d',
			totals: {
				hours_watched: hoursWatched,
				average_viewers: 5,
				peak_viewers: 20,
				airtime_hours: 2,
				stream_count: 3,
				followers_gain: null
			}
		};
	}

	it('enriches kick rows with 7d HW when channel detail exists (docs/16)', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => channelDetailBody('kick', 12_500)
		});
		const ctx = testLoadContext(fetchFn as typeof fetch);

		const enriched = await enrichSearchResultsWithRollups(ctx, [kickRow]);

		expect(enriched[0]?.hoursWatched7d).toBe('12.5K');
		expect(String(fetchFn.mock.calls[0]?.[0])).toContain('platform=kick');
	});

	it('enriches twitch rows with 7d HW when channel detail exists', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => channelDetailBody('twitch', 842)
		});
		const ctx = testLoadContext(fetchFn as typeof fetch);

		const enriched = await enrichSearchResultsWithRollups(ctx, [
			{ ...kickRow, platform: 'twitch', slug: 'ninja', displayName: 'Ninja' }
		]);

		expect(enriched[0]?.hoursWatched7d).toBe('842');
	});

	it('skips rollup enrichment for youtube', async () => {
		const fetchFn = vi.fn();
		const ctx = testLoadContext(fetchFn as typeof fetch);

		const enriched = await enrichSearchResultsWithRollups(ctx, [
			{ ...kickRow, platform: 'youtube', slug: 'mrbeast', displayName: 'MrBeast' }
		]);

		expect(enriched[0]?.hoursWatched7d).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});
});
