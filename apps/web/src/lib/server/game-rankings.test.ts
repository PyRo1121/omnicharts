import { describe, it, expect, vi } from 'vitest';
import { loadTwitchGameRankings } from './game-rankings';
import { testLoadContext } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

describe('loadTwitchGameRankings', () => {
	it('maps live game rankings', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				updated_at: '2026-06-01T00:00:00Z',
				items: [
					{
						rank: 1,
						slug: 'valorant',
						name: 'VALORANT',
						average_viewers: 50_000,
						hours_watched: 1_000_000,
						box_art_url: null
					}
				]
			})
		});

		const load = await loadTwitchGameRankings(testLoadContext(fetchFn as typeof fetch), '7d', 10);
		expect(load.source).toBe('live');
		expect(load.rows[0]?.name).toBe('VALORANT');
		expect(load.rows[0]?.metricLabel).toBe('Avg viewers');
	});

	it('returns unavailable when ingest fails (default)', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		const load = await loadTwitchGameRankings(testLoadContext(fetchFn as typeof fetch), '7d');
		expect(load.source).toBe('unavailable');
		expect(load.rows).toHaveLength(0);
	});
});
