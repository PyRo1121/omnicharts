import { describe, it, expect, vi, afterEach } from 'vitest';
import { requireAdminApiKey } from '../src/admin/auth';
import * as ingestLog from '../src/log';

describe('requireAdminApiKey', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns 401 when key is set and header missing', () => {
		const res = requireAdminApiKey(new Request('http://x/admin/twitch/discover', { method: 'POST' }), {
			ADMIN_API_KEY: 'secret'
		} as Env);
		expect(res?.status).toBe(401);
	});

	it('allows request when X-Admin-Api-Key matches', () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret' }
			}),
			{ ADMIN_API_KEY: 'secret' } as Env
		);
		expect(res).toBeNull();
	});

	it('allows Bearer token when key matches', () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', {
				method: 'POST',
				headers: { Authorization: 'Bearer secret' }
			}),
			{ ADMIN_API_KEY: 'secret' } as Env
		);
		expect(res).toBeNull();
	});

	it('bypasses when ADMIN_API_KEY unset in development', () => {
		const warn = vi.spyOn(ingestLog, 'ingestWarn').mockImplementation(() => {});
		const res = requireAdminApiKey(new Request('http://x/admin/twitch/discover', { method: 'POST' }), {
			ENVIRONMENT: 'development'
		} as Env);
		expect(res).toBeNull();
		expect(warn).toHaveBeenCalledOnce();
	});

	it('returns 503 in production when ADMIN_API_KEY unset', async () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', { method: 'POST' }),
			{ ENVIRONMENT: 'production' } as Env
		);
		expect(res?.status).toBe(503);
		const json = (await res!.json()) as { error: { code: string } };
		expect(json.error.code).toBe('service_unavailable');
	});

	it('returns 503 in staging when ADMIN_API_KEY unset', async () => {
		const res = requireAdminApiKey(
			new Request('http://x/admin/twitch/discover', { method: 'POST' }),
			{ ENVIRONMENT: 'staging' } as Env
		);
		expect(res?.status).toBe(503);
	});
});
