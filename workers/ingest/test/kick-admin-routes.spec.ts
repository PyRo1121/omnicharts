import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv, unusedIngestD1 } from './helpers';
import worker from '../src/index';
import * as kickDiscover from '../src/kick/discover';

describe('kick admin routes (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POST /admin/kick/discover returns 401 when ADMIN_API_KEY set and header missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/kick/discover', { method: 'POST' }),
			testEnv({
				ADMIN_API_KEY: 'secret',
				DB: unusedIngestD1(),
			}),
		);
		expect(res.status).toBe(401);
	});

	it('POST /admin/kick/discover returns ok with NEEDS_API stats when credentials missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/kick/discover', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret', 'content-type': 'application/json' },
				body: JSON.stringify({ quick: true }),
			}),
			testEnv({ ADMIN_API_KEY: 'secret', ENVIRONMENT: 'development', DB: unusedIngestD1() }),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(
			expect.objectContaining({
				ok: true,
				skipped: true,
				stats: expect.objectContaining({ categoriesScanned: 0 }),
			}),
		);
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
		};

		const res = await worker.fetch(
			new Request('http://ingest/admin/kick/discover', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret', 'content-type': 'application/json' },
				body: JSON.stringify({ quick: true }),
			}),
			testEnv({
				ADMIN_API_KEY: 'secret',
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				DB: db,
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(
			expect.objectContaining({
				ok: true,
				skipped: false,
				stats: expect.objectContaining({ channelsUpserted: 8 }),
			}),
		);
	});
});
