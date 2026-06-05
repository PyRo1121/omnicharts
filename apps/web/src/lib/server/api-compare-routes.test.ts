import { describe, it, expect, vi } from 'vitest';
import { GET as getCompareChannels } from '../../routes/api/v1/compare/channels/+server';

function mockD1WithChannels(): D1Database {
	return {
		prepare(sql: string) {
			if (sql.includes('lower(slug)')) {
				return {
					bind: (_platform: string, slug: string) => ({
						first: async () => ({ slug }),
					}),
				};
			}
			if (sql.includes('FROM channels') && sql.includes('display_name')) {
				return {
					bind: (_platform: string, slug: string) => ({
						first: async () => ({
							id: `id-${slug}`,
							slug,
							display_name: slug,
							avatar_url: null,
							language: null,
							first_observed_at: '2026-01-01T00:00:00Z',
							ingest_state: 'tracked',
							follower_count: null,
							description: null,
						}),
					}),
				};
			}
			if (sql.includes('channel_daily_rollups')) {
				return {
					bind: () => ({
						all: async () => ({
							results: [
								{
									date: '2026-06-01',
									hours_watched: 50,
									average_viewers: 5,
									peak_viewers: 10,
									airtime_minutes: 60,
									stream_count: 1,
									followers_delta: null,
								},
							],
						}),
					}),
				};
			}
			return { bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }) };
		},
	} as unknown as D1Database;
}

describe('GET /api/v1/compare/channels', () => {
	it('returns doc-07 error when slugs missing', async () => {
		const res = await getCompareChannels({
			url: new URL('http://localhost/api/v1/compare/channels?platform=twitch'),
			fetch: vi.fn(),
			platform: { env: { DB: mockD1WithChannels() } } as App.Platform,
		} as unknown as Parameters<typeof getCompareChannels>[0]);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: 'missing_slugs', message: 'query params a and b (channel slugs) are required' },
		});
	});

	it('returns rollup-backed compare payload', async () => {
		const res = await getCompareChannels({
			url: new URL('http://localhost/api/v1/compare/channels?a=ninja&b=shroud&platform=twitch&period=7d'),
			fetch: vi.fn(),
			platform: { env: { DB: mockD1WithChannels() } } as App.Platform,
		} as unknown as Parameters<typeof getCompareChannels>[0]);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			platform: string;
			a: { found: boolean };
			b: { found: boolean };
		};
		expect(body.platform).toBe('twitch');
		expect(body.a.found).toBe(true);
		expect(body.b.found).toBe(true);
	});
});
