import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import * as helixModule from '../src/twitch/helix';
import * as watchlistUpsert from '../src/watchlist/upsert';

const dbStub = {
	prepare: () => ({
		bind: () => ({ first: async () => null, run: async () => ({}) })
	})
} as unknown as D1Database;

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
			{ ADMIN_API_KEY: 'secret', DB: dbStub } as Env
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
			{ ADMIN_API_KEY: 'secret', DB: dbStub } as Env
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe('invalid_csv');
	});

	it('POST /admin/watchlist/import returns needs_api when twitch credentials missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/watchlist/import', {
				method: 'POST',
				headers: {
					'X-Admin-Api-Key': 'secret',
					'content-type': 'text/csv'
				},
				body: 'platform,slug\ntwitch,ninja'
			}),
			{ ADMIN_API_KEY: 'secret', DB: dbStub } as Env
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			ok: boolean;
			skipped: boolean;
			results: { status: string }[];
		};
		expect(body.ok).toBe(false);
		expect(body.skipped).toBe(true);
		expect(body.results[0]?.status).toBe('needs_api');
	});

	it('POST /admin/watchlist/import imports twitch row via Helix lookup', async () => {
		vi.spyOn(helixModule.TwitchHelixClient.prototype, 'getUsersByLogins').mockResolvedValue([
			{
				id: '123',
				login: 'ninja',
				display_name: 'Ninja',
				type: '',
				broadcaster_type: 'partner',
				description: '',
				profile_image_url: 'https://example.com/ninja.jpg',
				created_at: '2011-01-01T00:00:00Z'
			}
		]);
		vi.spyOn(watchlistUpsert, 'upsertTwitchChannelFromUser').mockResolvedValue({
			channelId: 'twitch-ch-123',
			created: true,
			promoted: false,
			skipped: false
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
			{
				ADMIN_API_KEY: 'secret',
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'sec',
				DB: dbStub
			} as Env
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; imported: number };
		expect(body.ok).toBe(true);
		expect(body.imported).toBe(1);
	});
});
