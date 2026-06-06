import { describe, it, expect, vi } from 'vitest';
import { GET as getChannelDetail } from '../../routes/api/v1/channels/[slug]/+server';
import { GET as getGameDetail } from '../../routes/api/v1/games/[slug]/+server';
import { mockD1FromSql } from './mock-d1';
import { testAppPlatform, testChannelDetailRequest, testGameDetailRequest } from './test-helpers';

function nullDb() {
	return mockD1FromSql(() => ({
		bind: () => ({
			first: async () => null,
			all: async () => ({ results: [] }),
		}),
	}));
}

describe('GET /api/v1/channels/[slug]', () => {
	it('returns doc-07 error envelope on 404', async () => {
		const db = nullDb();
		const res = await getChannelDetail(
			testChannelDetailRequest({
				params: { slug: 'missing' },
				url: new URL('http://localhost/api/v1/channels/missing?platform=twitch'),
				fetch: vi.fn(),
				platform: testAppPlatform(db),
			}),
		);

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			error: { code: 'not_found', message: 'Channel not found' },
		});
	});
});

describe('GET /api/v1/games/[slug]', () => {
	it('returns doc-07 error envelope on 404', async () => {
		const db = nullDb();
		const res = await getGameDetail(
			testGameDetailRequest({
				params: { slug: 'missing' },
				url: new URL('http://localhost/api/v1/games/missing?platform=twitch'),
				fetch: vi.fn(),
				platform: testAppPlatform(db),
			}),
		);

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			error: { code: 'not_found', message: 'Game not found' },
		});
	});

	it('returns doc-07 error envelope on kick 404', async () => {
		const db = nullDb();
		const res = await getGameDetail(
			testGameDetailRequest({
				params: { slug: 'missing' },
				url: new URL('http://localhost/api/v1/games/missing?platform=kick'),
				fetch: vi.fn(),
				platform: testAppPlatform(db),
			}),
		);

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			error: { code: 'not_found', message: 'Game not found' },
		});
	});
});
