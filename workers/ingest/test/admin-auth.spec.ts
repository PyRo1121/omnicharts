import { describe, it, expect, vi, afterEach } from 'vitest';
import { testEnv, TEST_ENV_NO_ADMIN_KEY } from './helpers';
import { requireAdminApiKey } from '../src/admin/auth';
import * as ingestLog from '../src/log';

describe('requireAdminApiKey', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns 401 when key is set and header missing', () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', { method: 'POST' }),
			testEnv({
				ADMIN_API_KEY: 'secret',
			}),
		);
		expect(res?.status).toBe(401);
	});

	it('allows request when X-Admin-Api-Key matches', () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret' },
			}),
			testEnv({ ADMIN_API_KEY: 'secret' }),
		);
		expect(res).toBeNull();
	});

	it('allows Bearer token when key matches', () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', {
				method: 'POST',
				headers: { Authorization: 'Bearer secret' },
			}),
			testEnv({ ADMIN_API_KEY: 'secret' }),
		);
		expect(res).toBeNull();
	});

	it('bypasses when ADMIN_API_KEY unset in development', () => {
		const warn = vi.spyOn(ingestLog, 'ingestWarn').mockImplementation(() => {});
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', { method: 'POST' }),
			testEnv({
				ENVIRONMENT: 'development',
				...TEST_ENV_NO_ADMIN_KEY,
			}),
		);
		expect(res).toBeNull();
		expect(warn).toHaveBeenCalledOnce();
	});

	it('returns 503 in production when ADMIN_API_KEY unset', async () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', { method: 'POST' }),
			testEnv({ ENVIRONMENT: 'production', ...TEST_ENV_NO_ADMIN_KEY }),
		);
		expect(res?.status).toBe(503);
		expect(await res!.json()).toEqual({
			error: {
				code: 'service_unavailable',
				message: 'Admin API is not configured (ADMIN_API_KEY missing)',
			},
		});
	});

	it('returns 503 in staging when ADMIN_API_KEY unset', async () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', { method: 'POST' }),
			testEnv({ ENVIRONMENT: 'staging', ...TEST_ENV_NO_ADMIN_KEY }),
		);
		expect(res?.status).toBe(503);
	});
});
