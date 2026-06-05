import { describe, it, expect } from 'vitest';
import { seedDevRankings } from '../src/dev/seed-rankings';

describe('seedDevRankings', () => {
	it('upserts 20 channels and rollups', async () => {
		const runs: { sql: string; args: unknown[] }[] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind(...args: unknown[]) {
						runs.push({ sql, args });
						return { run: async () => ({}) };
					},
				};
			},
		} as unknown as D1Database;

		const stats = await seedDevRankings({ DB: db } as Env);
		expect(stats.channels).toBe(20);
		expect(stats.rollupDays).toBe(7);
		const channelInserts = runs.filter((r) => r.sql.includes('INSERT INTO channels'));
		const rollupInserts = runs.filter((r) => r.sql.includes('channel_daily_rollups'));
		expect(channelInserts).toHaveLength(20);
		expect(rollupInserts).toHaveLength(20 * 7);
	});
});
