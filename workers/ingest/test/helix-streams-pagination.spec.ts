import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testEnv } from './helpers';
import { TwitchHelixClient } from '../src/twitch/helix';

vi.mock('../src/twitch/auth', () => ({
	getAppAccessToken: vi.fn().mockResolvedValue('test-token'),
}));

function fetchInputHref(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

describe('TwitchHelixClient streams pagination', () => {
	const env = testEnv({ TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'sec' });

	beforeEach(() => {
		let streamsCall = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((input: RequestInfo | URL) => {
				const url = fetchInputHref(input);
				if (url.includes('/helix/streams') && url.includes('game_id=42')) {
					return Promise.resolve(
						new Response(
							JSON.stringify({
								data: [
									{
										id: '1',
										user_id: 'u1',
										user_login: 'a',
										user_name: 'A',
										game_id: '42',
										game_name: 'G',
										title: 'T',
										viewer_count: 50,
										started_at: '2026-06-01T00:00:00Z',
										type: 'live',
									},
								],
								pagination: { cursor: 'page2' },
							}),
							{
								status: 200,
								headers: {
									'Ratelimit-Remaining': '700',
									'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
								},
							},
						),
					);
				}
				if (url.includes('/helix/streams')) {
					streamsCall++;
					if (streamsCall === 1) {
						return Promise.resolve(
							new Response(
								JSON.stringify({
									data: [
										{
											id: '2',
											user_id: 'u2',
											user_login: 'b',
											user_name: 'B',
											game_id: '9',
											game_name: 'G2',
											title: 'T2',
											viewer_count: 200,
											started_at: '2026-06-01T00:00:00Z',
											type: 'live',
										},
									],
									pagination: { cursor: 'next-cursor' },
								}),
								{
									status: 200,
									headers: {
										'Ratelimit-Remaining': '699',
										'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
									},
								},
							),
						);
					}
					return Promise.resolve(
						new Response(JSON.stringify({ data: [] }), {
							status: 200,
							headers: {
								'Ratelimit-Remaining': '698',
								'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
							},
						}),
					);
				}
				if (url.includes('/helix/games/top')) {
					return Promise.resolve(
						new Response(JSON.stringify({ data: [{ id: '1', name: 'Game', box_art_url: '' }] }), {
							status: 200,
							headers: {
								'Ratelimit-Remaining': '797',
								'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
							},
						}),
					);
				}
				return Promise.resolve(new Response('{}', { status: 404 }));
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getLiveStreamsPage passes after cursor', async () => {
		const client = new TwitchHelixClient(env);
		const page1 = await client.getLiveStreamsPage({ first: 100 });
		expect(page1.data).toHaveLength(1);
		expect(page1.pagination?.cursor).toBe('next-cursor');

		const page2 = await client.getLiveStreamsPage({ first: 100, after: 'next-cursor' });
		expect(page2.data).toHaveLength(0);

		const fetchMock = vi.mocked(fetch);
		const secondCall = fetchMock.mock.calls[1];
		if (!secondCall) throw new Error('expected second fetch call');
		const secondUrl = fetchInputHref(secondCall[0]);
		expect(secondUrl).toContain('after=next-cursor');
	});

	it('getStreamsByGameId includes game_id and pagination cursor', async () => {
		const client = new TwitchHelixClient(env);
		const page = await client.getStreamsByGameId('42', { first: 50, after: 'c0' });
		expect(page.data).toHaveLength(1);
		expect(page.pagination?.cursor).toBe('page2');

		const fetchMock = vi.mocked(fetch);
		const gameCall = fetchMock.mock.calls[0];
		if (!gameCall) throw new Error('expected fetch call');
		const url = fetchInputHref(gameCall[0]);
		expect(url).toContain('game_id=42');
		expect(url).toContain('after=c0');
		expect(url).toContain('first=50');
	});

	it('getTopGames returns data array', async () => {
		const client = new TwitchHelixClient(env);
		const games = await client.getTopGames(10);
		expect(games[0].name).toBe('Game');
	});
});
