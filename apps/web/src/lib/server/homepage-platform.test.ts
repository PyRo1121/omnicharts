import { describe, it, expect, vi } from 'vitest';
import { trendingSearches } from '$lib/mock/home';
import { load } from '../../routes/+page.server';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

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
	it('returns empty rankings and platformUnsupported for platform=kick', async () => {
		const result = await load(homepageLoadArgs('kick'));

		expect(result.platform).toBe('kick');
		expect(result.platformUnsupported).toBe(true);
		expect(result.channelRankings).toMatchObject({ source: 'live', rows: [] });
		expect(result.gameRankings).toMatchObject({ source: 'live', rows: [] });
		expect(result.trending).toEqual([...trendingSearches]);
	});

	it('returns empty rankings and platformUnsupported for platform=youtube', async () => {
		const result = await load(homepageLoadArgs('youtube'));

		expect(result.platform).toBe('youtube');
		expect(result.platformUnsupported).toBe(true);
		expect(result.channelRankings.rows).toHaveLength(0);
		expect(result.gameRankings.rows).toHaveLength(0);
	});

	it('defaults to twitch and does not mark platform unsupported', async () => {
		const result = await load(homepageLoadArgs(null));

		expect(result.platform).toBe('twitch');
		expect(result.platformUnsupported).toBe(false);
	});
});
