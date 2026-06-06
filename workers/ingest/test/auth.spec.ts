import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testEnv, TEST_ENV_NO_TWITCH_CREDS } from './helpers';
import { clearTokenCacheForTests, getAppAccessToken } from '../src/twitch/auth';
import { HelixRateBudget } from '../src/twitch/rate-limit';

describe('getAppAccessToken', () => {
	const budget = new HelixRateBudget();

	beforeEach(() => {
		clearTokenCacheForTests();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		clearTokenCacheForTests();
	});

	it('throws when credentials missing', async () => {
		await expect(getAppAccessToken(testEnv(TEST_ENV_NO_TWITCH_CREDS), budget)).rejects.toThrow(/Missing TWITCH/);
	});

	it('caches token until near expiry', async () => {
		let calls = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => {
				calls++;
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'tok-a', expires_in: 3600 }), {
						status: 200,
					}),
				);
			}),
		);

		const env = testEnv({ TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret' });
		const t1 = await getAppAccessToken(env, budget);
		const t2 = await getAppAccessToken(env, budget);
		expect(t1).toBe('tok-a');
		expect(t2).toBe('tok-a');
		expect(calls).toBe(1);
	});
});
