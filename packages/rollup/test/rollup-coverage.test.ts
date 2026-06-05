import { describe, expect, test } from 'vitest';
import { getRollupCoverageDays } from '../src/rollup-coverage';
import { mockD1Database } from './mock-d1';

describe('getRollupCoverageDays', () => {
	test('returns inclusive day span from oldest rollup date to today UTC', async () => {
		const db = mockD1Database((sql: string) => {
			expect(sql).toContain('MIN(date)');
			return {
				first: async () => ({ oldest: '2026-03-01' }),
			};
		});

		const days = await getRollupCoverageDays(db, new Date('2026-03-10T15:00:00.000Z'));
		expect(days).toBe(10);
	});

	test('returns null when no rollups exist', async () => {
		const db = mockD1Database(() => ({
			first: async () => ({ oldest: null }),
		}));

		await expect(getRollupCoverageDays(db)).resolves.toBeNull();
	});
});
