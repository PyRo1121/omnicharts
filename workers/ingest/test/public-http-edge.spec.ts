import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv, unusedIngestD1 } from './helpers';
import worker from '../src/index';
import { resetRankingsCacheForTests } from '../src/http/rankings-cache';
import { resetPublicRateLimitBucketsForTests } from '../src/http/rate-limit';
import * as channelsApi from '../src/ranking/channels-api';
import * as gamesApi from '../src/ranking/games-api';
import * as search from '../src/search/channels';

function mockDbForSlugResolve(canonical: { slug: string; from_history: boolean } | null) {
	let call = 0;
	return {
		prepare: vi.fn(() => {
			call += 1;
			return {
				bind: vi.fn().mockReturnValue({
					first: vi.fn().mockImplementation(async () => {
						if (!canonical) return null;
						if (call === 1 && !canonical.from_history) {
							return { slug: canonical.slug };
						}
						if (call === 1) return null;
						return { new_slug: canonical.slug };
					}),
				}),
			};
		}),
	};
}

describe('public HTTP edge cases (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		resetRankingsCacheForTests();
		resetPublicRateLimitBucketsForTests();
	});

	it('GET /v1/rankings/channels?period=365d returns 400 invalid_period', async () => {
		const res = await worker.fetch(new Request('http://ingest/v1/rankings/channels?period=365d'), testEnv({ DB: unusedIngestD1() }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: 'invalid_period', message: 'period must be one of 24h, 7d, 30d, 90d' },
		});
	});

	it('GET /v1/rankings/channels?language=english returns 400 invalid_language', async () => {
		const buildSpy = vi.spyOn(channelsApi, 'buildRankingsChannelsResponse');
		const res = await worker.fetch(new Request('http://ingest/v1/rankings/channels?language=english'), testEnv({ DB: unusedIngestD1() }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: {
				code: 'invalid_language',
				message: 'language must be a valid BCP 47 stream tag (e.g. en, es, zh-tw)',
			},
		});
		expect(buildSpy).not.toHaveBeenCalled();
	});

	it('POST /admin/twitch/discover returns 401 when ADMIN_API_KEY set and header missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/twitch/discover', { method: 'POST' }),
			testEnv({
				ADMIN_API_KEY: 'secret',
				DB: unusedIngestD1(),
			}),
		);
		expect(res.status).toBe(401);
	});

	it('GET /v1/channels/resolve returns canonical slug payload (from_history)', async () => {
		const db = mockDbForSlugResolve({ slug: 'newname', from_history: true });
		const res = await worker.fetch(new Request('http://ingest/v1/channels/resolve?slug=oldname&platform=twitch'), testEnv({ DB: db }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			platform: 'twitch',
			slug: 'newname',
			from_history: true,
		});
	});

	it('GET /v1/rankings/games?period=365d returns 400 invalid_period', async () => {
		const res = await worker.fetch(new Request('http://ingest/v1/rankings/games?period=365d'), testEnv({ DB: unusedIngestD1() }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: 'invalid_period', message: 'period must be one of 24h, 7d, 30d, 90d' },
		});
	});

	it('GET /v1/rankings/channels uses in-worker cache on repeat requests', async () => {
		const buildSpy = vi.spyOn(channelsApi, 'buildRankingsChannelsResponse').mockResolvedValue({
			platform: 'twitch',
			period: '7d',
			updated_at: '2026-06-03T00:00:00.000Z',
			items: [],
		});
		const env = testEnv({ DB: unusedIngestD1() });
		const req = new Request('http://ingest/v1/rankings/channels?platform=twitch&period=7d');
		const first = await worker.fetch(req, env);
		const second = await worker.fetch(req, env);
		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(buildSpy).toHaveBeenCalledTimes(1);
	});

	it('GET /v1/rankings/games uses in-worker cache on repeat requests', async () => {
		const buildSpy = vi.spyOn(gamesApi, 'buildRankingsGamesResponse').mockResolvedValue({
			platform: 'twitch',
			period: '7d',
			updated_at: '2026-06-03T00:00:00.000Z',
			items: [],
		});
		const env = testEnv({ DB: unusedIngestD1() });
		const req = new Request('http://ingest/v1/rankings/games?platform=twitch&period=7d');
		const first = await worker.fetch(req, env);
		const second = await worker.fetch(req, env);
		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(buildSpy).toHaveBeenCalledTimes(1);
	});

	it('GET /v1/rankings/channels returns 429 in production when rate limit exceeded', async () => {
		const env = testEnv({
			ENVIRONMENT: 'production',
			INGEST_RATE_LIMIT_PER_MINUTE: '2',
			DB: unusedIngestD1(),
		});
		const headers = { 'CF-Connecting-IP': '203.0.113.99' };
		const req = () => new Request('http://ingest/v1/rankings/channels?period=365d', { headers });
		expect((await worker.fetch(req(), env)).status).toBe(400);
		expect((await worker.fetch(req(), env)).status).toBe(400);
		const blocked = await worker.fetch(req(), env);
		expect(blocked.status).toBe(429);
		expect(await blocked.json()).toEqual({ error: { code: 'rate_limited', message: 'Too many requests' } });
	});

	it('GET /v1/search/channels returns 400 when query too short', async () => {
		const searchSpy = vi.spyOn(search, 'searchChannels').mockResolvedValue([]);
		const res = await worker.fetch(new Request('http://ingest/v1/search/channels?q=a&platform=twitch'), testEnv({ DB: unusedIngestD1() }));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: 'invalid_query', message: 'q must be between 2 and 100 characters' },
		});
		expect(searchSpy).not.toHaveBeenCalled();
	});

	it('GET /v1/search/channels returns 400 when query exceeds 100 chars', async () => {
		const searchSpy = vi.spyOn(search, 'searchChannels').mockResolvedValue([]);
		const res = await worker.fetch(
			new Request(`http://ingest/v1/search/channels?q=${'z'.repeat(101)}&platform=twitch`),
			testEnv({
				DB: unusedIngestD1(),
			}),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: 'invalid_query', message: 'q must be between 2 and 100 characters' },
		});
		expect(searchSpy).not.toHaveBeenCalled();
	});

	it('GET /v1/search/channels returns 400 invalid_language', async () => {
		const searchSpy = vi.spyOn(search, 'searchChannelsWithYoutubeSeed').mockResolvedValue([]);
		const res = await worker.fetch(
			new Request('http://ingest/v1/search/channels?q=sh&platform=twitch&language=english'),
			testEnv({
				DB: unusedIngestD1(),
			}),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: {
				code: 'invalid_language',
				message: 'language must be a valid BCP 47 stream tag (e.g. en, es, zh-tw)',
			},
		});
		expect(searchSpy).not.toHaveBeenCalled();
	});
});
