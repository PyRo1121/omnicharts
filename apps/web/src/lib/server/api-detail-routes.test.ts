import { describe, it, expect, vi } from 'vitest';
import { GET as getChannelDetail } from '../../routes/api/v1/channels/[slug]/+server';
import { GET as getGameDetail } from '../../routes/api/v1/games/[slug]/+server';

function nullDb(): D1Database {
	return {
		prepare() {
			return {
				bind: () => ({ first: async () => null, all: async () => ({ results: [] }) })
			};
		}
	} as unknown as D1Database;
}

describe('GET /api/v1/channels/[slug]', () => {
	it('returns doc-07 error envelope on 404', async () => {
		const db = nullDb();
		const res = await getChannelDetail({
			params: { slug: 'missing' },
			url: new URL('http://localhost/api/v1/channels/missing?platform=twitch'),
			fetch: vi.fn(),
			platform: { env: { DB: db } } as App.Platform
		} as unknown as Parameters<typeof getChannelDetail>[0]);

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			error: { code: 'not_found', message: 'Channel not found' }
		});
	});
});

describe('GET /api/v1/games/[slug]', () => {
	it('returns doc-07 error envelope on 404', async () => {
		const db = nullDb();
		const res = await getGameDetail({
			params: { slug: 'missing' },
			url: new URL('http://localhost/api/v1/games/missing?platform=twitch'),
			fetch: vi.fn(),
			platform: { env: { DB: db } } as App.Platform
		} as unknown as Parameters<typeof getGameDetail>[0]);

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			error: { code: 'not_found', message: 'Game not found' }
		});
	});
});
