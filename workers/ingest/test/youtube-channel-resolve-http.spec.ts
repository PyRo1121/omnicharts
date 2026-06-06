import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv } from './helpers';
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
					},
				}),
			}),
		};

		vi.spyOn(seed, 'seedYoutubeChannelByQuery').mockResolvedValue({
			id: 'youtube-ch-UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
			display_name: 'MrBeast',
			avatar_url: null,
			platform_id: 'youtube',
		});

		const res = await worker.fetch(
			new Request('http://ingest/v1/channels/resolve?slug=mrbeast&platform=youtube'),
			testEnv({
				DB: db,
				YOUTUBE_API_KEY: 'key',
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			platform: 'youtube',
			slug: 'mrbeast',
			from_history: false,
		});
	});
});
