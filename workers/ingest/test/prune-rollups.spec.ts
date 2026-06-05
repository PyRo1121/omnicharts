import { describe, it, expect } from 'vitest';
import {
	DAILY_ROLLUP_DELETE_BATCH_SIZE,
	DAILY_ROLLUP_RETENTION_DAYS,
	dailyRollupRetentionCutoffDate,
	pruneDailyRollupsOlderThanRetention,
} from '../src/db/prune-rollups';

describe('dailyRollupRetentionCutoffDate', () => {
	it('returns UTC date string 90 days before now', () => {
		expect(dailyRollupRetentionCutoffDate(new Date('2026-06-05T12:00:00.000Z'))).toBe('2026-03-07');
		expect(DAILY_ROLLUP_RETENTION_DAYS).toBe(90);
	});
});

describe('pruneDailyRollupsOlderThanRetention', () => {
	it('deletes channel and game rollups older than cutoff in batches', async () => {
		const cutoff = dailyRollupRetentionCutoffDate(new Date('2026-06-05T12:00:00.000Z'));
		let channelDeletes = 0;
		let gameDeletes = 0;

		const db = {
			prepare(sql: string) {
				return {
					bind(boundCutoff: string, limit: number) {
						expect(boundCutoff).toBe(cutoff);
						expect(limit).toBe(DAILY_ROLLUP_DELETE_BATCH_SIZE);
						const isChannel = sql.includes('channel_daily_rollups');
						return {
							run: async () => {
								if (isChannel) {
									channelDeletes += 1;
									const changes = channelDeletes === 1 ? DAILY_ROLLUP_DELETE_BATCH_SIZE : 4;
									return { meta: { changes } };
								}
								gameDeletes += 1;
								const changes = gameDeletes === 1 ? DAILY_ROLLUP_DELETE_BATCH_SIZE : 0;
								return { meta: { changes } };
							},
						};
					},
				};
			},
		};

		const result = await pruneDailyRollupsOlderThanRetention(db, new Date('2026-06-05T12:00:00.000Z'));
		expect(result.channelRows).toBe(DAILY_ROLLUP_DELETE_BATCH_SIZE + 4);
		expect(result.gameRows).toBe(DAILY_ROLLUP_DELETE_BATCH_SIZE);
		expect(channelDeletes).toBe(2);
		expect(gameDeletes).toBe(2);
	});

	it('returns zero when nothing to delete', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					run: async () => ({ meta: { changes: 0 } }),
				}),
			}),
		};

		await expect(pruneDailyRollupsOlderThanRetention(db, new Date('2026-06-05T12:00:00.000Z'))).resolves.toEqual({
			channelRows: 0,
			gameRows: 0,
		});
	});
});
