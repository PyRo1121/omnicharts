import { describe, expect, test } from 'bun:test';
import type { D1Database } from '../src/d1';
import { queryTopGamesByAverageViewers } from '../src/ranking-queries';

describe('queryTopGamesByAverageViewers SQL eligibility', () => {
	test('requires contributing tracked channels meet minAverageViewers in EXISTS', async () => {
		let capturedSql = '';
		let binds: unknown[] = [];
		const db = {
			prepare(sql: string) {
				capturedSql = sql;
				return {
					bind(...args: unknown[]) {
						binds = args;
						return { all: async () => ({ results: [] }) };
					}
				};
			}
		} as unknown as D1Database;

		await queryTopGamesByAverageViewers(db, {
			platformId: 'twitch',
			days: 7,
			limit: 10,
			minAirtimeMinutes: 60,
			minAverageViewers: 20
		});

		expect(capturedSql).toContain('SUM(cr.hours_watched) * 60.0 / NULLIF(SUM(cr.airtime_minutes), 0)');
		expect(capturedSql).toMatch(/HAVING SUM\(cr\.airtime_minutes\) >= \?\s+AND/);
		expect(capturedSql).toContain('ss.started_at >= date');
		expect(capturedSql).toContain('eligible.game_category_id = gc.id');
		expect(binds).toEqual(['twitch', '7', '7', 60, 20, 'twitch', '7', 60, 10]);
	});
});
