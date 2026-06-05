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
	it('skips ingest channel detail for non-twitch platforms', async () => {
		const fetchFn = vi.fn();
		const ctx = testLoadContext(fetchFn as typeof fetch);

		const enriched = await enrichSearchResultsWithRollups(ctx, [
			{
				id: '1',
				slug: 'xqc',
				displayName: 'xQc',
				avatarUrl: null,
				platform: 'kick',
				hoursWatched7d: null
			}
		]);

		expect(enriched[0]?.hoursWatched7d).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});
});
