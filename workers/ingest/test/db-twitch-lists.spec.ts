import { describe, it, expect } from 'vitest';
import { listChannelIdsToPoll, listPlatformIdsForRollupDate, listRecentlyTrackedPlatformIds } from '../src/db/twitch';

function mockDb(rows: { platform_channel_id: string }[], captureSql = false) {
	const sql: string[] = [];
	return {
		db: {
			prepare(q: string) {
				if (captureSql) sql.push(q);
				return {
					bind: () => ({
						all: async () => ({ results: rows }),
					}),
				};
			},
		} as unknown as D1Database,
		sql,
	};
}

describe('db twitch channel lists', () => {
	it('listRecentlyTrackedPlatformIds maps platform_channel_id', async () => {
		const { db } = mockDb([{ platform_channel_id: '111' }, { platform_channel_id: '222' }]);
		const ids = await listRecentlyTrackedPlatformIds(db, 3, 10);
		expect(ids).toEqual(['111', '222']);
	});

	it('listChannelIdsToPoll maps tracked ids', async () => {
		const { db } = mockDb([{ platform_channel_id: '9' }]);
		const ids = await listChannelIdsToPoll(db, 5);
		expect(ids).toEqual(['9']);
	});

	it('listPlatformIdsForRollupDate maps distinct platform_channel_id for rollup date', async () => {
		const { db } = mockDb([{ platform_channel_id: '545050196' }]);
		const ids = await listPlatformIdsForRollupDate(db, '2026-05-30', 500);
		expect(ids).toEqual(['545050196']);
	});

	it('listPlatformIdsForRollupDate orders by last_seen_at desc before limit', async () => {
		const { db, sql } = mockDb([], true);
		await listPlatformIdsForRollupDate(db, '2026-05-30', 100);
		expect(sql[0]).toMatch(/ORDER BY MAX\(c\.last_seen_at\) DESC/i);
		expect(sql[0]).toMatch(/LIMIT \?/);
	});
});
