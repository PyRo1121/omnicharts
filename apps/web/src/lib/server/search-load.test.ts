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
	it('forwards platform=kick to ingest and enriches results with rollup HW', async () => {
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
			if (url.includes('/v1/channels/xqc') && url.includes('platform=kick')) {
				return Promise.resolve({
					ok: true,
					status: 200,
					json: async () => ({
						platform: 'kick',
						slug: 'xqc',
						display_name: 'xQc',
						avatar_url: null,
						tracked_since: '2026-01-01T00:00:00Z',
						ingest_state: 'tracked',
						follower_count: 100,
						description: null,
						period: '7d',
						totals: {
							hours_watched: 12_500,
							average_viewers: 5,
							peak_viewers: 20,
							airtime_hours: 2,
							stream_count: 3,
							followers_gain: null
						}
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
			hoursWatched7d: '12.5K'
		});
	});

	it('rejects invalid platform query and defaults to twitch', async () => {
		const fetchFn = vi.fn().mockImplementation((input: string | URL) => {
			const url = String(input);
			if (url.includes('/v1/search/channels')) {
				expect(url).toContain('platform=twitch');
				return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
			}
			if (url.includes('/v1/rankings/channels')) {
				return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
			}
			return Promise.resolve({ ok: false, status: 503 });
		});

		const args = searchLoadArgs('ab', 'not-a-platform');
		args.fetch = fetchFn;

		const result = await searchLoad(args);
		expect(result.platform).toBe('twitch');
	});

	it('loads kick trending chips from kick rankings', async () => {
		const fetchFn = vi.fn().mockImplementation((input: string | URL) => {
			const url = String(input);
			if (url.includes('/v1/search/channels')) {
				return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
			}
			if (url.includes('/v1/rankings/channels') && url.includes('platform=kick')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						updated_at: '2026-06-01T00:00:00Z',
						items: [
							{
								rank: 1,
								slug: 'xqc',
								display_name: 'xQc',
								avatar_url: null,
								hours_watched: 1,
								average_viewers: 1
							}
						]
					})
				});
			}
			return Promise.resolve({ ok: false, status: 503 });
		});

		const args = searchLoadArgs('', 'kick');
		args.fetch = fetchFn;

		const result = await searchLoad(args);
		expect(result.trending[0]).toMatchObject({ slug: 'xqc', platform: 'kick' });
	});
});
