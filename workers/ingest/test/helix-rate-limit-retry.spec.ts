import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testEnv } from './helpers';
import { HELIX_429_MAX_RETRIES, TwitchHelixClient } from '../src/twitch/helix';
import { helixRateLimitWaitMs } from '../src/twitch/rate-limit';

vi.mock('../src/twitch/auth', () => ({
	getAppAccessToken: vi.fn().mockResolvedValue('test-token'),
}));

describe('helixRateLimitWaitMs', () => {
	it('waits until Ratelimit-Reset unix timestamp', () => {
		const resetSec = Math.floor(Date.now() / 1000) + 30;
		const headers = new Headers({
			'Ratelimit-Reset': String(resetSec),
		});
		const waitMs = helixRateLimitWaitMs(headers);
		expect(waitMs).toBeGreaterThanOrEqual(100);
		expect(waitMs).toBeLessThanOrEqual(30_100);
	});

	it('falls back when reset header missing', () => {
		expect(helixRateLimitWaitMs(new Headers())).toBe(5_100);
	});
});

describe('TwitchHelixClient 429 handling', () => {
	const env = testEnv({ TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'sec' });

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('retries GET /streams after 429 using Ratelimit-Reset', async () => {
		let calls = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => {
				calls++;
				if (calls === 1) {
					return Promise.resolve(
						new Response('rate limited', {
							status: 429,
							headers: {
								'Ratelimit-Remaining': '0',
								'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 2),
							},
						}),
					);
				}
				return Promise.resolve(
					new Response(JSON.stringify({ data: [] }), {
						status: 200,
						headers: {
							'Ratelimit-Remaining': '700',
							'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
						},
					}),
				);
			}),
		);

		const client = new TwitchHelixClient(env);
		const promise = client.getLiveStreamsPage({ first: 100 });
		await vi.advanceTimersByTimeAsync(3_000);
		const page = await promise;

		expect(page.data).toEqual([]);
		expect(calls).toBe(2);
	});

	it('retries user_id batch when Ratelimit-Remaining is 0 on 200', async () => {
		let calls = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => {
				calls++;
				if (calls === 1) {
					return Promise.resolve(
						new Response(JSON.stringify({ data: [] }), {
							status: 200,
							headers: {
								'Ratelimit-Remaining': '0',
								'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 1),
							},
						}),
					);
				}
				return Promise.resolve(
					new Response(
						JSON.stringify({
							data: [
								{
									id: '1',
									user_id: 'u1',
									user_login: 'u1',
									user_name: 'U1',
									game_id: '1',
									game_name: 'G',
									title: 'T',
									viewer_count: 10,
									started_at: '2026-06-01T00:00:00Z',
									type: 'live',
								},
							],
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
			}),
		);

		const client = new TwitchHelixClient(env);
		const promise = client.getStreamsByUserIds(['u1']);
		await vi.advanceTimersByTimeAsync(2_000);
		const streams = await promise;

		expect(streams).toHaveLength(1);
		expect(calls).toBe(2);
	});

	it(`stops after ${HELIX_429_MAX_RETRIES} rate-limit responses`, async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('rate limited', {
					status: 429,
					headers: {
						'Ratelimit-Remaining': '0',
						'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 1),
					},
				}),
			),
		);

		const client = new TwitchHelixClient(env);
		const promise = client.getLiveStreamsPage({ first: 100 });
		const rejection = expect(promise).rejects.toThrow(/rate limited after/);
		await vi.runAllTimersAsync();
		await rejection;
		expect(vi.mocked(fetch)).toHaveBeenCalledTimes(HELIX_429_MAX_RETRIES + 1);
	});
});
