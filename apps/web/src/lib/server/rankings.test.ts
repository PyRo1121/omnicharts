import { describe, it, expect, vi } from 'vitest';
import { loadTwitchChannelRankings } from './rankings';
import { testLoadContext, testLoadContextWithDb } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

describe('loadTwitchChannelRankings', () => {
	it('uses D1 only when binding present (no ingest fallback)', async () => {
		const fetchFn = vi.fn();
		const db = {
			prepare: vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: [
						{
							slug: 'ninja',
							display_name: 'Ninja',
							avatar_url: 'https://cdn.example/a.png',
							first_observed_at: '2026-01-01T00:00:00Z',
							hours_watched: 12_000,
							average_viewers: 500,
							airtime_minutes: 1440,
							peak_viewers: 800
						}
					]
				})
			})
		} as unknown as D1Database;

		const load = await loadTwitchChannelRankings(
			testLoadContextWithDb(fetchFn as typeof fetch, db),
			'7d',
			20
		);
		expect(load.source).toBe('live');
		expect(load.rows[0]?.slug).toBe('ninja');
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('maps live ingest rankings', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				platform: 'twitch',
				period: '7d',
				updated_at: '2026-06-01T00:00:00Z',
				items: [
					{
						rank: 1,
						slug: 'ninja',
						display_name: 'Ninja',
						avatar_url: 'https://cdn.example/a.png',
						hours_watched: 12_000,
						average_viewers: 500
					}
				]
			})
		});

		const load = await loadTwitchChannelRankings(testLoadContext(fetchFn as typeof fetch), '7d', 20);
		expect(load.source).toBe('live');
		expect(load.rows[0]).toMatchObject({
			slug: 'ninja',
			displayName: 'Ninja',
			metricLabel: 'Hours watched'
		});
		expect(String(fetchFn.mock.calls[0]?.[0])).toContain('/v1/rankings/channels');
	});

	it('returns empty live rows when ingest has no items', async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				updated_at: '2026-06-01T00:00:00Z',
				items: []
			})
		});
		const load = await loadTwitchChannelRankings(testLoadContext(fetchFn as typeof fetch), '30d');
		expect(load.source).toBe('live');
		expect(load.rows).toHaveLength(0);
	});

	it('returns unavailable when ingest fails (default)', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		const load = await loadTwitchChannelRankings(testLoadContext(fetchFn as typeof fetch), '7d');
		expect(load.source).toBe('unavailable');
		expect(load.rows).toHaveLength(0);
	});

	it('returns mock rows when mockEnabled and ingest fails', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		const load = await loadTwitchChannelRankings(testLoadContext(fetchFn as typeof fetch), '7d', 20, true);
		expect(load.source).toBe('mock');
		expect(load.rows.length).toBeGreaterThan(0);
	});
});
