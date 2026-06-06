import { describe, it, expect, vi } from 'vitest';
import { loadGameRankings } from './game-rankings';
import { testLoadContext } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' },
}));

describe('loadGameRankings (twitch)', () => {
	it('maps live game rankings', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				platform: 'twitch',
				period: '7d',
				updated_at: '2026-06-01T00:00:00Z',
				items: [
					{
						rank: 1,
						slug: 'valorant',
						name: 'VALORANT',
						average_viewers: 50_000,
						hours_watched: 1_000_000,
						box_art_url: null,
					},
				],
			}),
		});

		const load = await loadGameRankings(testLoadContext(fetchFn as typeof fetch), 'twitch', '7d', 10);
		expect(load.source).toBe('live');
		expect(load.rows[0]?.name).toBe('VALORANT');
		expect(load.rows[0]?.metricLabel).toBe('Avg viewers');
	});

	it('returns unavailable when ingest fails (default)', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		const load = await loadGameRankings(testLoadContext(fetchFn as typeof fetch), 'twitch', '7d');
		expect(load.source).toBe('unavailable');
		expect(load.rows).toHaveLength(0);
	});

	it('passes platform=kick to ingest rankings URL', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				platform: 'kick',
				period: '7d',
				updated_at: '2026-06-01T00:00:00Z',
				items: [
					{
						rank: 1,
						slug: 'just-chatting',
						name: 'Just Chatting',
						average_viewers: 8500,
						hours_watched: 120000,
						box_art_url: null,
					},
				],
			}),
		});

		const load = await loadGameRankings(testLoadContext(fetchFn as typeof fetch), 'kick', '7d', 20);
		expect(load.rows[0]).toMatchObject({ slug: 'just-chatting', platform: 'kick' });
		expect(String(fetchFn.mock.calls[0]?.[0])).toContain('platform=kick');
	});

	it('passes platform=youtube to ingest rankings URL', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				platform: 'youtube',
				period: '7d',
				updated_at: '2026-06-01T00:00:00Z',
				items: [],
			}),
		});

		const load = await loadGameRankings(testLoadContext(fetchFn as typeof fetch), 'youtube', '7d', 20);
		expect(load.source).toBe('live');
		expect(load.rows).toHaveLength(0);
		expect(String(fetchFn.mock.calls[0]?.[0])).toContain('platform=youtube');
	});
});
