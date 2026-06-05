import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv, unusedIngestD1 } from './helpers';
import worker from '../src/index';
import * as poll from '../src/youtube/poll';
import * as seed from '../src/youtube/seed';

describe('youtube admin routes (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POST /admin/youtube/poll returns 401 when ADMIN_API_KEY set and header missing', async () => {
		const res = await worker.fetch(new Request('http://ingest/admin/youtube/poll', { method: 'POST' }), testEnv({
			ADMIN_API_KEY: 'secret',
			DB: unusedIngestD1(),
		}));
		expect(res.status).toBe(401);
	});

	it('POST /admin/youtube/poll returns NEEDS_API poll stats when key missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/youtube/poll', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret', 'content-type': 'application/json' },
				body: JSON.stringify({}),
			}),
			testEnv({ ADMIN_API_KEY: 'secret', ENVIRONMENT: 'development', DB: unusedIngestD1() }),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			ok: true,
			skipped: true,
			poll: { skipped: 'NEEDS_API' },
		});
	});

	it('POST /admin/youtube/poll runs poll and optional seed handles', async () => {
		vi.spyOn(poll, 'runYoutubeCatalogPoll').mockResolvedValue({
			batches: 1,
			liveVideos: 2,
			samplesWritten: 2,
		});
		vi.spyOn(seed, 'seedYoutubeChannels').mockResolvedValue({
			seeded: 1,
			skipped: 0,
			errors: 0,
		});

		const res = await worker.fetch(
			new Request('http://ingest/admin/youtube/poll', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret', 'content-type': 'application/json' },
				body: JSON.stringify({ seed: ['mrbeast'] }),
			}),
			testEnv({
				ADMIN_API_KEY: 'secret',
				YOUTUBE_API_KEY: 'yt-key',
				DB: unusedIngestD1(),
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			ok: true,
			skipped: false,
			poll: { liveVideos: 2 },
			seed: { seeded: 1 },
		});
	});
});
