import { describe, expect, test } from 'bun:test';
import type { D1Database } from '../src/d1';
import { getRollupCoverageDays } from '../src/rollup-coverage';

describe('getRollupCoverageDays', () => {
	test('returns inclusive day span from oldest rollup date to today UTC', async () => {
		const db = {
			prepare(sql: string) {
				expect(sql).toContain('MIN(date)');
				return {
					first: async () => ({ oldest: '2026-03-01' })
				};
			}
		} as unknown as D1Database;

		const days = await getRollupCoverageDays(db, new Date('2026-03-10T15:00:00.000Z'));
		expect(days).toBe(10);
	});

	test('returns null when no rollups exist', async () => {
		const db = {
			prepare: () => ({
				first: async () => ({ oldest: null })
			})
		} as unknown as D1Database;

		await expect(getRollupCoverageDays(db)).resolves.toBeNull();
	});
});
