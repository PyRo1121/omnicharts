import { describe, it, expect } from 'vitest';
import {
	countChannelLiveSightings14d,
	recordChannelLiveSighting,
	shouldPromoteDiscoveredToTracked
} from '../src/db/live-sightings';

describe('live-sightings promotion', () => {
	it('shouldPromoteDiscoveredToTracked requires 2 sightings', () => {
		expect(shouldPromoteDiscoveredToTracked(0)).toBe(false);
		expect(shouldPromoteDiscoveredToTracked(1)).toBe(false);
		expect(shouldPromoteDiscoveredToTracked(2)).toBe(true);
	});

	it('recordChannelLiveSighting inserts and prunes', async () => {
		const runs: string[] = [];
		const db = {
			prepare(sql: string) {
				runs.push(sql);
				return {
					bind: () => ({ run: async () => ({}) })
				};
			}
		} as unknown as D1Database;

		await recordChannelLiveSighting(db, 'ch-1', 100);
		expect(runs.some((s) => s.includes('INSERT INTO channel_live_sightings'))).toBe(true);
		expect(runs.some((s) => s.includes('DELETE FROM channel_live_sightings'))).toBe(true);
	});

	it('countChannelLiveSightings14d returns count', async () => {
		const db = {
			prepare(sql: string) {
				return {
					bind: () => ({
						first: async () => {
							expect(sql).toContain('channel_live_sightings');
							return { n: 2 };
						}
					})
				};
			}
		} as unknown as D1Database;

		expect(await countChannelLiveSightings14d(db, 'ch-1')).toBe(2);
	});
});
