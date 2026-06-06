import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv, unusedIngestD1, TEST_ENV_NO_TWITCH_CREDS } from './helpers';
import worker from '../src/index';
import * as vodBackfill from '../src/twitch/vod-backfill';

describe('VOD backfill admin routes (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POST /admin/twitch/vod-backfill returns 401 without admin key', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/twitch/vod-backfill', { method: 'POST' }),
			testEnv({
				ADMIN_API_KEY: 'secret',
				DB: unusedIngestD1(),
			}),
		);
		expect(res.status).toBe(401);
	});

	it('POST /admin/twitch/vod-backfill returns NEEDS_API stats when credentials missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/twitch/vod-backfill', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret' },
			}),
			testEnv({ ADMIN_API_KEY: 'secret', DB: unusedIngestD1(), ...TEST_ENV_NO_TWITCH_CREDS }),
		);
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body).toEqual(expect.objectContaining({ error: expect.stringContaining('not configured') }));
	});

	it('POST /admin/twitch/vod-backfill returns stats on success', async () => {
		vi.spyOn(vodBackfill, 'runTwitchVodBackfill').mockResolvedValue({
			ok: true,
			candidates: 2,
			channels_processed: 2,
			videos_fetched: 5,
			sessions_upserted: 4,
			pages: 3,
		});

		const res = await worker.fetch(
			new Request('http://ingest/admin/twitch/vod-backfill', {
				method: 'POST',
				headers: {
					'X-Admin-Api-Key': 'secret',
					'content-type': 'application/json',
				},
				body: JSON.stringify({ limit: 2 }),
			}),
			testEnv({
				ADMIN_API_KEY: 'secret',
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'secret',
				DB: unusedIngestD1(),
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(
			expect.objectContaining({
				ok: true,
				mode: 'vod_backfill',
				stats: expect.objectContaining({ sessions_upserted: 4 }),
			}),
		);
	});
});
