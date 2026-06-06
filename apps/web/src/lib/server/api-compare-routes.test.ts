import { describe, it, expect, vi } from 'vitest';
import { GET as getCompareChannels } from '../../routes/api/v1/compare/channels/+server';
import { mockD1FromSql } from './mock-d1';
import { testAppPlatform, testCompareChannelsRequest } from './test-helpers';

function mockD1WithChannels() {
	return mockD1FromSql((sql: string) => {
		if (sql.includes('lower(slug)')) {
			return {
				bind: (..._args: unknown[]) => ({
					first: async () => ({ slug: typeof _args[1] === 'string' ? _args[1] : '' }),
				}),
			};
		}
		if (sql.includes('FROM channels') && sql.includes('display_name')) {
			return {
				bind: (..._args: unknown[]) => {
					const slug = typeof _args[1] === 'string' ? _args[1] : '';
					return {
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
					};
				},
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
	});
}

describe('GET /api/v1/compare/channels', () => {
	it('returns doc-07 error when slugs missing', async () => {
		const res = await getCompareChannels(
			testCompareChannelsRequest({
				url: new URL('http://localhost/api/v1/compare/channels?platform=twitch'),
				fetch: vi.fn(),
				platform: testAppPlatform(mockD1WithChannels()),
			}),
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: 'missing_slugs', message: 'query params a and b (channel slugs) are required' },
		});
	});

	it('returns rollup-backed compare payload', async () => {
		const res = await getCompareChannels(
			testCompareChannelsRequest({
				url: new URL('http://localhost/api/v1/compare/channels?a=ninja&b=shroud&platform=twitch&period=7d'),
				fetch: vi.fn(),
				platform: testAppPlatform(mockD1WithChannels()),
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			platform: 'twitch',
			a: { found: true },
			b: { found: true },
		});
	});
});
