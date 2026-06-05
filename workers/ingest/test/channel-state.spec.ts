import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	markChannelsDormantWithoutRecentActivity,
	markChannelRetired,
	batchMarkChannelsRetired,
	recordSlugChangeIfNeeded
} from '../src/db/channel-state';
import { d1BatchFromDb } from './helpers/d1-batch-mock';

describe('channel-state', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('markChannelsDormantWithoutRecentActivity updates tracked stale rows', async () => {
		const run = vi.fn().mockResolvedValue({ meta: { changes: 3 } });
		const db = {
			prepare(sql: string) {
				expect(sql).toContain("ingest_state = 'dormant'");
				expect(sql).toContain("ingest_state = 'tracked'");
				return { bind: () => ({ run }) };
			}
		} as unknown as D1Database;

		const n = await markChannelsDormantWithoutRecentActivity(db, 30);
		expect(n).toBe(3);
	});

	it('markChannelsDormantWithoutRecentActivity returns 0 when meta missing', async () => {
		const db = {
			prepare() {
				return { bind: () => ({ run: async () => ({ meta: {} }) }) };
			}
		} as unknown as D1Database;
		expect(await markChannelsDormantWithoutRecentActivity(db, 7)).toBe(0);
	});

	it('markChannelRetired sets retired state', async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		const db = {
			prepare(sql: string) {
				expect(sql).toContain("ingest_state = 'retired'");
				return {
					bind: (...args: unknown[]) => {
						expect(args[0]).toBe('twitch');
						expect(args[1]).toBe('123');
						return { run };
					}
				};
			},
			batch: d1BatchFromDb({
				prepare(sql: string) {
					return {
						bind: (...args: unknown[]) => {
							expect(args[0]).toBe('twitch');
							expect(args[1]).toBe('123');
							return { run };
						}
					};
				}
			})
		} as unknown as D1Database;

		await markChannelRetired(db, '123');
		expect(run).toHaveBeenCalled();
	});

	it('batchMarkChannelsRetired returns 0 for empty input', async () => {
		const db = { batch: async () => [] } as unknown as D1Database;
		expect(await batchMarkChannelsRetired(db, [])).toBe(0);
	});

	it('batchMarkChannelsRetired batches retire UPDATEs', async () => {
		const batches: unknown[][] = [];
		const db = {
			prepare() {
				return { bind: () => ({ run: async () => ({}) }) };
			},
			async batch(statements: unknown[]) {
				batches.push(statements);
			}
		} as unknown as D1Database;

		expect(await batchMarkChannelsRetired(db, ['111', '222'])).toBe(2);
		expect(batches).toHaveLength(1);
		expect(batches[0]).toHaveLength(2);
	});

	it('recordSlugChangeIfNeeded no-ops when slug unchanged', async () => {
		const db = { prepare: vi.fn() } as unknown as D1Database;
		await recordSlugChangeIfNeeded(db, {
			channelId: 'ch-1',
			oldSlug: 'alpha',
			newSlug: 'alpha'
		});
		expect(db.prepare).not.toHaveBeenCalled();
	});

	it('recordSlugChangeIfNeeded inserts slug_history', async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		const db = {
			prepare(sql: string) {
				expect(sql).toContain('slug_history');
				return {
					bind: (...args: unknown[]) => {
						expect(args[1]).toBe('old-name');
						expect(args[2]).toBe('new-name');
						return { run };
					}
				};
			}
		} as unknown as D1Database;

		await recordSlugChangeIfNeeded(db, {
			channelId: 'ch-1',
			oldSlug: 'old-name',
			newSlug: 'new-name'
		});
		expect(run).toHaveBeenCalled();
	});
});
