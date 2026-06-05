import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import * as kickDiscover from '../src/kick/discover';

describe('kick admin routes (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POST /admin/kick/discover returns 401 when ADMIN_API_KEY set and header missing', async () => {
		const res = await worker.fetch(new Request('http://ingest/admin/kick/discover', { method: 'POST' }), {
			ADMIN_API_KEY: 'secret',
			DB: {} as D1Database,
		} as Env);
		expect(res.status).toBe(401);
	});

	it('POST /admin/kick/discover returns ok with NEEDS_API stats when credentials missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/kick/discover', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret', 'content-type': 'application/json' },
				body: JSON.stringify({ quick: true }),
			}),
			{ ADMIN_API_KEY: 'secret', ENVIRONMENT: 'development', DB: {} as D1Database } as Env,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; skipped: boolean; stats: { categoriesScanned: number } };
		expect(body.ok).toBe(true);
		expect(body.skipped).toBe(true);
		expect(body.stats.categoriesScanned).toBe(0);
	});

	it('POST /admin/kick/discover runs discovery when credentials present', async () => {
		vi.spyOn(kickDiscover, 'runKickDiscovery').mockResolvedValue({
			categoriesScanned: 2,
			categoryListPagesFetched: 1,
			streamsSeen: 10,
			channelsUpserted: 8,
		});

		const db = {
			prepare: () => ({
				bind: () => ({ run: async () => ({}) }),
			}),
		} as unknown as D1Database;

		const res = await worker.fetch(
			new Request('http://ingest/admin/kick/discover', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret', 'content-type': 'application/json' },
				body: JSON.stringify({ quick: true }),
			}),
			{
				ADMIN_API_KEY: 'secret',
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				DB: db,
			} as Env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; skipped: boolean; stats: { channelsUpserted: number } };
		expect(body.ok).toBe(true);
		expect(body.skipped).toBe(false);
		expect(body.stats.channelsUpserted).toBe(8);
	});
});
