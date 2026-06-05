import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TwitchHelixClient } from '../src/twitch/helix';

vi.mock('../src/twitch/auth', () => ({
	getAppAccessToken: vi.fn().mockResolvedValue('test-token')
}));

describe('TwitchHelixClient followers and stream batches', () => {
	const env = { TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'sec' } as Env;

	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/channels/followers')) {
					return Promise.resolve(
						new Response(JSON.stringify({ total: 42, data: [] }), {
							status: 200,
							headers: {
								'Ratelimit-Remaining': '500',
								'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60)
							}
						})
					);
				}
				if (url.includes('/helix/streams') && url.includes('user_id')) {
					return Promise.resolve(
						new Response(
							JSON.stringify({
								data: [
									{
										id: '1',
										user_id: '99',
										user_login: 'u',
										user_name: 'U',
										game_id: '1',
										game_name: 'G',
										title: 'T',
										viewer_count: 10,
										started_at: '2026-06-01T00:00:00Z',
										type: 'live'
									}
								]
							}),
							{
								status: 200,
								headers: {
									'Ratelimit-Remaining': '499',
									'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60)
								}
							}
						)
					);
				}
				return Promise.resolve(new Response('err', { status: 500 }));
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getChannelFollowerTotal returns total', async () => {
		const client = new TwitchHelixClient(env);
		expect(await client.getChannelFollowerTotal('123')).toBe(42);
	});

	it('getChannelFollowerTotals maps broadcaster ids', async () => {
		const client = new TwitchHelixClient(env);
		const map = await client.getChannelFollowerTotals(['123', '456']);
		expect(map.get('123')).toBe(42);
		expect(map.get('456')).toBe(42);
	});

	it('getStreamsByUserIds returns empty for no ids', async () => {
		const client = new TwitchHelixClient(env);
		expect(await client.getStreamsByUserIds([])).toEqual([]);
	});

	it('getStreamsByUserIds batches live streams', async () => {
		const client = new TwitchHelixClient(env);
		const streams = await client.getStreamsByUserIds(['99']);
		expect(streams).toHaveLength(1);
	});

	it('getChannelFollowerTotal returns null on HTTP error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('err', {
					status: 500,
					headers: {
						'Ratelimit-Remaining': '100',
						'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60)
					}
				})
			)
		);
		const client = new TwitchHelixClient(env);
		expect(await client.getChannelFollowerTotal('1')).toBeNull();
		vi.unstubAllGlobals();
	});
});
