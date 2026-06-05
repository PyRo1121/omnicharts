import { describe, it, expect } from 'vitest';
import { loadHomepageFromD1 } from './homepage-d1';
import { mockD1Batch } from './test-helpers';

describe('loadHomepageFromD1', () => {
	it('maps one D1 batch into overview rankings', async () => {
		const db = mockD1Batch([
			{ results: [{ n: 1200 }] },
			{ results: [{ n: 42 }] },
			{
				results: [
					{
						slug: 'alpha',
						display_name: 'Alpha',
						avatar_url: null,
						first_observed_at: '2026-01-01T00:00:00Z',
						hours_watched: 500,
						average_viewers: 50,
						airtime_minutes: 600,
						peak_viewers: 100,
					},
				],
			},
			{
				results: [
					{
						slug: 'valorant',
						name: 'VALORANT',
						hours_watched: 200,
						average_viewers: 80,
					},
				],
			},
		]);

		const snapshot = await loadHomepageFromD1(db, '7d', 5, 5);
		expect(snapshot.trackedChannels).toBe(1200);
		expect(snapshot.channelsLive).toBe(42);
		expect(snapshot.channelRankings.rows[0]?.displayName).toBe('Alpha');
		expect(snapshot.gameRankings.rows[0]?.name).toBe('VALORANT');
		expect(db.batch).toHaveBeenCalledOnce();
	});
});
