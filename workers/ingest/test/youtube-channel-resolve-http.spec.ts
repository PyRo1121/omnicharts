import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import * as seed from '../src/youtube/seed';

describe('YouTube channel resolve (worker.fetch)', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('GET /v1/channels/resolve seeds unknown YouTube handle via channels.list', async () => {
		const db = {
			prepare: (sql: string) => ({
				bind: () => ({
					first: async () => {
						if (sql.includes('slug_history')) return null;
						return null;
					}
				})
			})
		} as unknown as D1Database;

		vi.spyOn(seed, 'seedYoutubeChannelByQuery').mockResolvedValue({
			id: 'youtube-ch-UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
			display_name: 'MrBeast',
			avatar_url: null,
			platform_id: 'youtube'
		});

		const res = await worker.fetch(
			new Request('http://ingest/v1/channels/resolve?slug=mrbeast&platform=youtube'),
			{ DB: db, YOUTUBE_API_KEY: 'key' } as Env
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { slug: string; from_history: boolean; platform: string };
		expect(body).toEqual({
			platform: 'youtube',
			slug: 'mrbeast',
			from_history: false
		});
	});
});
