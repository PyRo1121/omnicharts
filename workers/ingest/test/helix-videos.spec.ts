import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv } from './helpers';
import { TwitchHelixClient } from '../src/twitch/helix';
import { HelixRateBudget } from '../src/twitch/rate-limit';
import * as auth from '../src/twitch/auth';

describe('TwitchHelixClient archive videos', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(auth, 'getAppAccessToken').mockResolvedValue('token');
	});

	it('returns empty data when broadcaster has no VODs', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			}),
		);

		const client = new TwitchHelixClient(testEnv({ TWITCH_CLIENT_ID: 'id' }));
		const page = await client.getArchiveVideosPage('12345');
		expect(page.data).toEqual([]);
	});

	it('paginates archive videos with cursor', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: [{ id: 'v1', user_id: '12345', type: 'archive' }],
						pagination: { cursor: 'page2' },
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [{ id: 'v2', user_id: '12345', type: 'archive' }] }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				}),
			);

		vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

		const client = new TwitchHelixClient(testEnv({ TWITCH_CLIENT_ID: 'id' }));
		const page1 = await client.getArchiveVideosPage('12345', { first: 1 });
		expect(page1.data?.[0]?.id).toBe('v1');
		const page2 = await client.getArchiveVideosPage('12345', { first: 1, after: 'page2' });
		expect(page2.data?.[0]?.id).toBe('v2');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('retries GET /videos after 429', async () => {
		vi.spyOn(HelixRateBudget.prototype, 'applyHeaders').mockImplementation(() => {});
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response('rate limited', {
					status: 429,
					headers: { 'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 1) },
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [{ id: 'v1', user_id: '99', type: 'archive' }] }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				}),
			);
		vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

		const client = new TwitchHelixClient(testEnv({ TWITCH_CLIENT_ID: 'id' }));
		const page = await client.getArchiveVideosPage('99');
		expect(page.data?.[0]?.id).toBe('v1');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
