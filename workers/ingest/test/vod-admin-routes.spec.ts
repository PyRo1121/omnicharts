import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import * as vodBackfill from '../src/twitch/vod-backfill';

describe('VOD backfill admin routes (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POST /admin/twitch/vod-backfill returns 401 without admin key', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/twitch/vod-backfill', { method: 'POST' }),
			{ ADMIN_API_KEY: 'secret', DB: {} as D1Database } as Env
		);
		expect(res.status).toBe(401);
	});

	it('POST /admin/twitch/vod-backfill returns NEEDS_API stats when credentials missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/twitch/vod-backfill', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret' }
			}),
			{ ADMIN_API_KEY: 'secret', DB: {} as D1Database } as Env
		);
		expect(res.status).toBe(503);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('not configured');
	});

	it('POST /admin/twitch/vod-backfill returns stats on success', async () => {
		vi.spyOn(vodBackfill, 'runTwitchVodBackfill').mockResolvedValue({
			ok: true,
			candidates: 2,
			channels_processed: 2,
			videos_fetched: 5,
			sessions_upserted: 4,
			pages: 3
		});

		const res = await worker.fetch(
			new Request('http://ingest/admin/twitch/vod-backfill', {
				method: 'POST',
				headers: {
					'X-Admin-Api-Key': 'secret',
					'content-type': 'application/json'
				},
				body: JSON.stringify({ limit: 2 })
			}),
			{
				ADMIN_API_KEY: 'secret',
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'secret',
				DB: {} as D1Database
			} as Env
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; stats: { sessions_upserted: number } };
		expect(body.ok).toBe(true);
		expect(body.stats.sessions_upserted).toBe(4);
	});
});
