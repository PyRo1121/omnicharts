import { describe, expect, test } from 'bun:test';
import type { D1Database } from '../src/d1';
import { queryTopGamesByAverageViewers, queryTopChannelsByHoursWatched } from '../src/ranking-queries';

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

	test('binds 90-day window for 90d rankings', async () => {
		let binds: unknown[] = [];
		const db = {
			prepare() {
				return {
					bind(...args: unknown[]) {
						binds = args;
						return { all: async () => ({ results: [] }) };
					}
				};
			}
		} as unknown as D1Database;

		const { queryTopChannelsByHoursWatched: queryTop } = await import('../src/ranking-queries');
		await queryTop(db, {
			platformId: 'kick',
			days: 90,
			limit: 20
		});

		expect(binds[0]).toBe('kick');
		expect(binds[1]).toBe('90');
	});

	test('adds language filter to channel rankings SQL when set', async () => {
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

		await queryTopChannelsByHoursWatched(db, {
			platformId: 'twitch',
			days: 7,
			limit: 10,
			language: 'en'
		});

		expect(capturedSql).toContain('lower(c.language) = ?');
		expect(binds).toEqual(['twitch', '7', 'en', 60, 0, 10]);
	});
});
