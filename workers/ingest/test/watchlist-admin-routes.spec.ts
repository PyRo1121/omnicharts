import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import * as watchlistImport from '../src/watchlist/import';

describe('watchlist admin routes (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POST /admin/watchlist/import returns 401 without admin key', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/watchlist/import', {
				method: 'POST',
				headers: { 'content-type': 'text/csv' },
				body: 'platform,slug\ntwitch,ninja'
			}),
			{ ADMIN_API_KEY: 'secret', DB: {} as D1Database } as Env
		);
		expect(res.status).toBe(401);
	});

	it('POST /admin/watchlist/import returns 400 for empty CSV', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/watchlist/import', {
				method: 'POST',
				headers: {
					'X-Admin-Api-Key': 'secret',
					'content-type': 'text/csv'
				},
				body: ''
			}),
			{ ADMIN_API_KEY: 'secret', DB: {} as D1Database } as Env
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe('invalid_csv');
	});

	it('POST /admin/watchlist/import returns stats on valid CSV', async () => {
		vi.spyOn(watchlistImport, 'importWatchlistCsv').mockResolvedValue({
			ok: true,
			skipped: false,
			imported: 1,
			promoted: 0,
			skipped_rows: 0,
			not_found: 0,
			errors: 0,
			parse_errors: 0,
			parse: {
				rows: [{ line: 2, platform: 'twitch', slug: 'ninja' }],
				errors: []
			},
			results: [{ line: 2, platform: 'twitch', slug: 'ninja', status: 'imported' }]
		});

		const res = await worker.fetch(
			new Request('http://ingest/admin/watchlist/import', {
				method: 'POST',
				headers: {
					'X-Admin-Api-Key': 'secret',
					'content-type': 'text/csv'
				},
				body: 'platform,slug\ntwitch,ninja'
			}),
			{ ADMIN_API_KEY: 'secret', DB: {} as D1Database } as Env
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; imported: number };
		expect(body.ok).toBe(true);
		expect(body.imported).toBe(1);
	});
});
