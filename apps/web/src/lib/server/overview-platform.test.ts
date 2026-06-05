import { describe, it, expect, vi } from 'vitest';
import { load } from '../../routes/overview/+page.server';
import type { PageData } from '../../routes/overview/$types';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' },
}));

type OverviewLoad = (event: Parameters<typeof load>[0]) => Promise<PageData>;
const overviewLoad = load as OverviewLoad;

function overviewLoadArgs(platform: string | null) {
	const url = new URL('http://localhost/overview');
	if (platform) url.searchParams.set('platform', platform);

	const setHeaders = vi.fn();
	const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });

	return {
		fetch: fetchFn,
		url,
		setHeaders,
		platform: undefined,
	} as unknown as Parameters<typeof load>[0];
}

describe('overview load — platform query (docs/09 Phase 3)', () => {
	it('loads kick overview from ingest rankings', async () => {
		const fetchFn = vi.fn().mockImplementation((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('/rankings/games')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						platform: 'kick',
						period: '7d',
						updated_at: '2026-06-01T00:00:00Z',
						items: [],
					}),
				});
			}
			if (url.includes('/rankings/channels')) {
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
								average_viewers: 200,
							},
						],
					}),
				});
			}
			return Promise.resolve({ ok: false, status: 503 });
		});
		const args = overviewLoadArgs('kick');
		args.fetch = fetchFn as typeof fetch;

		const result = await overviewLoad(args);

		expect(result.platform).toBe('kick');
		expect(result.topChannelName).toBe('xQc');
		expect(result.stats).toHaveLength(3);
		expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('/rankings/channels') && String(c[0]).includes('platform=kick'))).toBe(
			true,
		);
	});

	it('loads youtube overview when ingest has no items', async () => {
		const fetchFn = vi.fn().mockImplementation((_input: RequestInfo | URL) => {
			return Promise.resolve({
				ok: true,
				json: async () => ({
					platform: 'youtube',
					period: '7d',
					updated_at: '2026-06-01T00:00:00Z',
					items: [],
				}),
			});
		});
		const args = overviewLoadArgs('youtube');
		args.fetch = fetchFn as typeof fetch;

		const result = await overviewLoad(args);

		expect(result.platform).toBe('youtube');
		expect(result.stats).toHaveLength(3);
		expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('/rankings/channels') && String(c[0]).includes('platform=youtube'))).toBe(
			true,
		);
	});

	it('defaults to twitch and does not mark platform unsupported', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		const args = overviewLoadArgs(null);
		args.fetch = fetchFn as typeof fetch;

		const result = await overviewLoad(args);

		expect(result.platform).toBe('twitch');
		expect(result.stats.length).toBeGreaterThan(0);
	});
});
