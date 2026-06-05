import { describe, it, expect, vi } from 'vitest';
import { trendingSearches } from '$lib/mock/home';
import { load } from '../../routes/+page.server';
import type { PageData } from '../../routes/$types';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

type HomepageLoad = (event: Parameters<typeof load>[0]) => Promise<PageData>;
const homepageLoad = load as HomepageLoad;

function homepageLoadArgs(platform: string | null) {
	const url = new URL('http://localhost/');
	if (platform) url.searchParams.set('platform', platform);

	const setHeaders = vi.fn();
	const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });

	return {
		fetch: fetchFn,
		url,
		setHeaders,
		platform: undefined
	} as unknown as Parameters<typeof load>[0];
}

describe('homepage load — non-Twitch platforms (docs/09 Phase 3)', () => {
	it('loads kick channel rankings without platformUnsupported banner', async () => {
		const fetchFn = vi.fn().mockImplementation((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('/rankings/games')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						platform: 'kick',
						period: '7d',
						updated_at: '2026-06-01T00:00:00Z',
						items: []
					})
				});
			}
			return Promise.resolve({
				ok: true,
				json: async () => ({
					platform: 'kick',
					period: '7d',
					updated_at: '2026-06-01T00:00:00Z',
					items: [
						{
							rank: 1,
							slug: 'xqc',
							display_name: 'xQc',
							avatar_url: null,
							hours_watched: 5000,
							average_viewers: 200
						}
					]
				})
			});
		});
		const args = homepageLoadArgs('kick');
		args.fetch = fetchFn as typeof fetch;

		const result = await homepageLoad(args);

		expect(result.platform).toBe('kick');
		expect(result.platformUnsupported).toBe(false);
		expect(result.overview.topChannelName).toBe('xQc');
		expect(result.overview.stats.some((s) => s.label.includes('Top 20 ranked'))).toBe(true);
		expect(result.channelRankings.rows[0]?.slug).toBe('xqc');
		expect(result.gameRankings).toMatchObject({ source: 'live', rows: [] });
		expect(
			fetchFn.mock.calls.some(
				(c) => String(c[0]).includes('/rankings/channels') && String(c[0]).includes('platform=kick')
			)
		).toBe(true);
		expect(
			fetchFn.mock.calls.some(
				(c) => String(c[0]).includes('/rankings/games') && String(c[0]).includes('platform=kick')
			)
		).toBe(true);
	});

	it('returns empty rankings and platformUnsupported for platform=youtube', async () => {
		const result = await homepageLoad(homepageLoadArgs('youtube'));

		expect(result.platform).toBe('youtube');
		expect(result.platformUnsupported).toBe(true);
		expect(result.channelRankings.rows).toHaveLength(0);
		expect(result.gameRankings.rows).toHaveLength(0);
	});

	it('defaults to twitch and does not mark platform unsupported', async () => {
		const result = await homepageLoad(homepageLoadArgs(null));

		expect(result.platform).toBe('twitch');
		expect(result.platformUnsupported).toBe(false);
	});
});
