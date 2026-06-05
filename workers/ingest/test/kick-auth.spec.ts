import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testEnv } from './helpers';
import { clearKickTokenCacheForTests, getKickAppAccessToken } from '../src/kick/auth';

describe('getKickAppAccessToken', () => {
	beforeEach(() => {
		clearKickTokenCacheForTests();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		clearKickTokenCacheForTests();
	});

	it('throws when credentials missing', async () => {
		await expect(getKickAppAccessToken(testEnv())).rejects.toThrow(/Missing KICK/);
	});

	it('caches token until near expiry', async () => {
		let calls = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => {
				calls++;
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'kick-tok', expires_in: 3600 }), {
						status: 200,
					}),
				);
			}),
		);

		const env = testEnv({ KICK_CLIENT_ID: 'id', KICK_CLIENT_SECRET: 'secret' });
		const t1 = await getKickAppAccessToken(env);
		const t2 = await getKickAppAccessToken(env);
		expect(t1).toBe('kick-tok');
		expect(t2).toBe('kick-tok');
		expect(calls).toBe(1);
	});

	it('posts client_credentials to id.kick.com', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'x', expires_in: 3600 }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		await getKickAppAccessToken(testEnv({
			KICK_CLIENT_ID: 'cid',
			KICK_CLIENT_SECRET: 'csec',
		}));

		expect(fetchMock).toHaveBeenCalledWith('https://id.kick.com/oauth/token', expect.objectContaining({ method: 'POST' }));
		const init = fetchMock.mock.calls[0]?.[1];
		expect(init?.body).toBeInstanceOf(URLSearchParams);
		if (!(init?.body instanceof URLSearchParams)) throw new Error('expected URLSearchParams body');
		expect(init.body.get('grant_type')).toBe('client_credentials');
		expect(init.body.get('client_id')).toBe('cid');
	});
});
