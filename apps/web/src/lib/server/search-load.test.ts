import { describe, it, expect, vi } from 'vitest';
import { load } from '../../routes/search/+page.server';
import type { PageData } from '../../routes/search/$types';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

type SearchLoad = (event: Parameters<typeof load>[0]) => Promise<PageData>;
const searchLoad = load as SearchLoad;

function searchLoadArgs(q: string, platform: string) {
	const url = new URL(`http://localhost/search?q=${encodeURIComponent(q)}&platform=${platform}`);
	const setHeaders = vi.fn();

	return {
		fetch: vi.fn(),
		url,
		setHeaders,
		platform: undefined
	} as unknown as Parameters<typeof load>[0];
}

describe('search page load — platform=kick', () => {
	it('forwards platform=kick to ingest and returns results without rollup HW', async () => {
		const fetchFn = vi.fn().mockImplementation((input: string | URL) => {
			const url = String(input);
			if (url.includes('/v1/search/channels')) {
				expect(url).toContain('platform=kick');
				return Promise.resolve({
					ok: true,
					json: async () => ({
						results: [
							{
								id: 'kick-1',
								slug: 'xqc',
								display_name: 'xQc',
								avatar_url: null,
								platform_id: 'kick'
							}
						]
					})
				});
			}
			if (url.includes('/v1/rankings/channels')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ items: [] })
				});
			}
			return Promise.resolve({ ok: false, status: 503 });
		});

		const args = searchLoadArgs('xqc', 'kick');
		args.fetch = fetchFn;

		const result = await searchLoad(args);

		expect(result.platform).toBe('kick');
		expect(result.q).toBe('xqc');
		expect(result.error).toBe(false);
		expect(result.results).toHaveLength(1);
		expect(result.results[0]).toMatchObject({
			slug: 'xqc',
			platform: 'kick',
			hoursWatched7d: null
		});
	});
});
