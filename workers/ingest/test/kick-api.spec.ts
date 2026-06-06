import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testEnv } from './helpers';
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
						status: 200,
					}),
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
								category: { id: 5, name: 'Slots' },
							},
						],
					}),
					{ status: 200 },
				),
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const env = testEnv({ KICK_CLIENT_ID: 'id', KICK_CLIENT_SECRET: 'secret' });
		const client = new KickPublicApiClient(env);
		const streams = await client.getLivestreamsByBroadcasterIds(['1']);

		expect(streams).toHaveLength(1);
		expect(streams[0]?.slug).toBe('one');
	});

	it('returns empty array for no broadcaster IDs', async () => {
		const client = new KickPublicApiClient(testEnv());
		await expect(client.getLivestreamsByBroadcasterIds([])).resolves.toEqual([]);
	});

	it('getCategoriesV2 hits /public/v2/categories with cursor pagination', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('id.kick.com')) {
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
						status: 200,
					}),
				);
			}
			expect(url).toContain('api.kick.com/public/v2/categories');
			expect(url).toContain('limit=50');
			return Promise.resolve(
				new Response(
					JSON.stringify({
						data: [{ id: 9, name: 'Rust', tags: ['survival'] }],
						message: 'OK',
						pagination: { next_cursor: 'abc' },
					}),
					{ status: 200 },
				),
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = new KickPublicApiClient(
			testEnv({
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
			}),
		);
		const page = await client.getCategoriesV2({ limit: 50 });

		expect(page.data).toHaveLength(1);
		expect(page.pagination?.next_cursor).toBe('abc');
	});

	it('getLivestreamsByCategoryId uses category_id sort and limit', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('id.kick.com')) {
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
						status: 200,
					}),
				);
			}
			expect(url).toContain('category_id=42');
			expect(url).toContain('limit=100');
			expect(url).toContain('sort=viewer_count');
			return Promise.resolve(
				new Response(
					JSON.stringify({
						data: [
							{
								broadcaster_user_id: 7,
								channel_id: 70,
								slug: 'seven',
								stream_title: 'Live',
								started_at: '2026-06-01T00:00:00Z',
								viewer_count: 50,
							},
						],
					}),
					{ status: 200 },
				),
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = new KickPublicApiClient(
			testEnv({
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
			}),
		);
		const streams = await client.getLivestreamsByCategoryId(42, {
			limit: 100,
			sort: 'viewer_count',
		});

		expect(streams).toHaveLength(1);
		expect(streams[0]?.slug).toBe('seven');
	});

	it('throws when livestreams API returns non-OK', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('id.kick.com')) {
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
						status: 200,
					}),
				);
			}
			return Promise.resolve(new Response('upstream error', { status: 503 }));
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = new KickPublicApiClient(
			testEnv({
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
			}),
		);

		await expect(client.getLivestreamsByCategoryId(1)).rejects.toThrow(/503/);
	});
});
