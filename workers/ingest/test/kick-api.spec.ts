import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearKickTokenCacheForTests } from '../src/kick/auth';
import { KickPublicApiClient } from '../src/kick/api';

describe('KickPublicApiClient', () => {
	beforeEach(() => {
		clearKickTokenCacheForTests();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		clearKickTokenCacheForTests();
	});

	it('getLivestreamsByBroadcasterIds batches at 50 IDs', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('id.kick.com')) {
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
						status: 200
					})
				);
			}
			expect(url).toContain('api.kick.com/public/v1/livestreams');
			expect(url).toContain('broadcaster_user_id=1');
			expect(url).toContain('sort=viewer_count');
			return Promise.resolve(
				new Response(
					JSON.stringify({
						data: [
							{
								broadcaster_user_id: 1,
								channel_id: 10,
								slug: 'one',
								stream_title: 'Live',
								started_at: '2026-06-01T00:00:00Z',
								viewer_count: 100,
								category: { id: 5, name: 'Slots' }
							}
						]
					}),
					{ status: 200 }
				)
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const env = { KICK_CLIENT_ID: 'id', KICK_CLIENT_SECRET: 'secret' } as Env;
		const client = new KickPublicApiClient(env);
		const streams = await client.getLivestreamsByBroadcasterIds(['1']);

		expect(streams).toHaveLength(1);
		expect(streams[0]?.slug).toBe('one');
	});

	it('returns empty array for no broadcaster IDs', async () => {
		const client = new KickPublicApiClient({} as Env);
		await expect(client.getLivestreamsByBroadcasterIds([])).resolves.toEqual([]);
	});
});
