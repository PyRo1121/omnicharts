import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import * as poll from '../src/youtube/poll';
import * as seed from '../src/youtube/seed';

describe('youtube admin routes (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('POST /admin/youtube/poll returns 401 when ADMIN_API_KEY set and header missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/youtube/poll', { method: 'POST' }),
			{ ADMIN_API_KEY: 'secret', DB: {} as D1Database } as Env
		);
		expect(res.status).toBe(401);
	});

	it('POST /admin/youtube/poll returns NEEDS_API poll stats when key missing', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/youtube/poll', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret', 'content-type': 'application/json' },
				body: JSON.stringify({})
			}),
			{ ADMIN_API_KEY: 'secret', ENVIRONMENT: 'development', DB: {} as D1Database } as Env
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			ok: boolean;
			skipped: boolean;
			poll: { skipped?: string };
		};
		expect(body.ok).toBe(true);
		expect(body.skipped).toBe(true);
		expect(body.poll.skipped).toBe('NEEDS_API');
	});

	it('POST /admin/youtube/poll runs poll and optional seed handles', async () => {
		vi.spyOn(poll, 'runYoutubeCatalogPoll').mockResolvedValue({
			batches: 1,
			liveVideos: 2,
			samplesWritten: 2
		});
		vi.spyOn(seed, 'seedYoutubeChannels').mockResolvedValue({
			seeded: 1,
			skipped: 0,
			errors: 0
		});

		const res = await worker.fetch(
			new Request('http://ingest/admin/youtube/poll', {
				method: 'POST',
				headers: { 'X-Admin-Api-Key': 'secret', 'content-type': 'application/json' },
				body: JSON.stringify({ seed: ['mrbeast'] })
			}),
			{
				ADMIN_API_KEY: 'secret',
				YOUTUBE_API_KEY: 'yt-key',
				DB: {} as D1Database
			} as Env
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			ok: boolean;
			skipped: boolean;
			poll: { liveVideos: number };
			seed: { seeded: number };
		};
		expect(body.ok).toBe(true);
		expect(body.skipped).toBe(false);
		expect(body.poll.liveVideos).toBe(2);
		expect(body.seed.seeded).toBe(1);
	});
});
