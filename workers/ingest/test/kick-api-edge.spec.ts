import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearKickTokenCacheForTests } from '../src/kick/auth';
import { KickPublicApiClient } from '../src/kick/api';
import * as rateLimit from '../src/kick/rate-limit';

describe('KickPublicApiClient edge cases', () => {
	beforeEach(() => {
		clearKickTokenCacheForTests();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		clearKickTokenCacheForTests();
	});

	it('retries on 429 then succeeds', async () => {
		vi.spyOn(rateLimit, 'sleepMs').mockResolvedValue(undefined);
		let liveCalls = 0;
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('id.kick.com')) {
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
						status: 200
					})
				);
			}
			liveCalls += 1;
			if (liveCalls === 1) {
				return Promise.resolve(
					new Response('rate limited', {
						status: 429,
						headers: { 'Retry-After': '0' }
					})
				);
			}
			return Promise.resolve(
				new Response(JSON.stringify({ data: [{ broadcaster_user_id: 1, channel_id: 10, slug: 'one', stream_title: 'T', started_at: '2026-06-01T00:00:00Z', viewer_count: 5 }] }), {
					status: 200
				})
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = new KickPublicApiClient({
			KICK_CLIENT_ID: 'id',
			KICK_CLIENT_SECRET: 'secret'
		} as Env);
		const streams = await client.getLivestreamsByBroadcasterIds(['1']);
		expect(streams).toHaveLength(1);
		expect(liveCalls).toBe(2);
	});

	it('getLivestreamsByBroadcasterIds splits batches over 50 IDs', async () => {
		const liveCalls: string[] = [];
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('id.kick.com')) {
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
						status: 200
					})
				);
			}
			liveCalls.push(url);
			return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
		});
		vi.stubGlobal('fetch', fetchMock);

		const ids = Array.from({ length: 51 }, (_, i) => String(i + 1));
		const client = new KickPublicApiClient({
			KICK_CLIENT_ID: 'id',
			KICK_CLIENT_SECRET: 'secret'
		} as Env);
		await client.getLivestreamsByBroadcasterIds(ids);

		expect(liveCalls).toHaveLength(2);
		expect(liveCalls[0]).toContain('broadcaster_user_id=1');
		expect(liveCalls[1]).toContain('broadcaster_user_id=51');
	});

	it('getChannelsBySlug returns empty for blank slug', async () => {
		const client = new KickPublicApiClient({} as Env);
		await expect(client.getChannelsBySlug('')).resolves.toEqual([]);
		await expect(client.getChannelsBySlug('   ')).resolves.toEqual([]);
	});

	it('getChannelsBySlug returns empty when API has no match', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('id.kick.com')) {
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
						status: 200
					})
				);
			}
			expect(url).toContain('slug=not-a-real-channel-xyz');
			return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
		});
		vi.stubGlobal('fetch', fetchMock);

		const client = new KickPublicApiClient({
			KICK_CLIENT_ID: 'id',
			KICK_CLIENT_SECRET: 'secret'
		} as Env);
		const channels = await client.getChannelsBySlug('not-a-real-channel-xyz');
		expect(channels).toEqual([]);
	});
});
