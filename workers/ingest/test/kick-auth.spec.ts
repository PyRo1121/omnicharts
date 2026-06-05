import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
		await expect(getKickAppAccessToken({} as Env)).rejects.toThrow(/Missing KICK/);
	});

	it('caches token until near expiry', async () => {
		let calls = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => {
				calls++;
				return Promise.resolve(
					new Response(JSON.stringify({ access_token: 'kick-tok', expires_in: 3600 }), {
						status: 200
					})
				);
			})
		);

		const env = { KICK_CLIENT_ID: 'id', KICK_CLIENT_SECRET: 'secret' } as Env;
		const t1 = await getKickAppAccessToken(env);
		const t2 = await getKickAppAccessToken(env);
		expect(t1).toBe('kick-tok');
		expect(t2).toBe('kick-tok');
		expect(calls).toBe(1);
	});

	it('posts client_credentials to id.kick.com', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'x', expires_in: 3600 }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		await getKickAppAccessToken({
			KICK_CLIENT_ID: 'cid',
			KICK_CLIENT_SECRET: 'csec'
		} as Env);

		expect(fetchMock).toHaveBeenCalledWith(
			'https://id.kick.com/oauth/token',
			expect.objectContaining({ method: 'POST' })
		);
		const body = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
		expect(body.get('grant_type')).toBe('client_credentials');
		expect(body.get('client_id')).toBe('cid');
	});
});
