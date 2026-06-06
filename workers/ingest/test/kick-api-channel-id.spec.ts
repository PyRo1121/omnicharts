import { describe, it, expect, vi } from 'vitest';
import { batchRecordKickApiChannelIds, recordKickApiChannelId, resolveKickApiChannelId } from '../src/kick/api-channel-id';
import { mockIngestD1 } from './helpers';

describe('kick api-channel-id metadata', () => {
	it('recordKickApiChannelId no-ops for non-finite channelId', async () => {
		const run = vi.fn();
		const db = { prepare: () => ({ bind: () => ({ run }) }) };
		await recordKickApiChannelId(db, '42', Number.NaN);
		expect(run).not.toHaveBeenCalled();
	});

	it('batchRecordKickApiChannelIds skips invalid ids and batches valid rows', async () => {
		const runs: string[] = [];
		const db = mockIngestD1(
			(sql) => ({
				bind: (...args: unknown[]) => ({
					run: async () => {
						runs.push(`${sql}:${String(args[0])}`);
						return {};
					},
				}),
			}),
			async (statements) => {
				for (const stmt of statements) await stmt.run();
				return statements.map(() => ({ meta: { rows_written: 1 } }));
			},
		);
		await batchRecordKickApiChannelIds(db, [
			{ broadcasterUserId: 'a', channelId: 10 },
			{ broadcasterUserId: 'b', channelId: Number.NaN },
			{ broadcasterUserId: 'c', channelId: 20 },
		]);
		expect(runs).toHaveLength(2);
		expect(runs[0]).toContain('kick_api_channel_id:a');
		expect(runs[1]).toContain('kick_api_channel_id:c');
	});

	it('batchRecordKickApiChannelIds no-ops on empty input', async () => {
		const batch = vi.fn(async () => []);
		const db = mockIngestD1(() => ({ bind: () => ({ run: async () => ({}) }) }), batch);
		await batchRecordKickApiChannelIds(db, []);
		expect(batch).not.toHaveBeenCalled();
	});

	it('resolveKickApiChannelId returns null for missing or invalid metadata', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					first: async () => null,
				}),
			}),
		};
		await expect(resolveKickApiChannelId(db, '42')).resolves.toBeNull();

		const badDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({ value: 'not-a-number' }),
				}),
			}),
		};
		await expect(resolveKickApiChannelId(badDb, '42')).resolves.toBeNull();
	});

	it('resolveKickApiChannelId parses stored channel id', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({ value: '420' }),
				}),
			}),
		};
		await expect(resolveKickApiChannelId(db, '42')).resolves.toBe(420);
	});
});
