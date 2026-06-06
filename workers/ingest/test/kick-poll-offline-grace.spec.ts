import { describe, expect, it, vi } from 'vitest';
import { KICK_OFFLINE_MISS_THRESHOLD, kickBroadcasterIdsReadyToClose, resetKickPollMissCounters } from '../src/kick/poll-offline-grace';
import { mockIngestD1 } from './helpers';

describe('kick poll offline grace', () => {
	it('resetKickPollMissCounters no-ops on empty ids', async () => {
		const run = vi.fn();
		const db = mockIngestD1(() => ({ bind: () => ({ run }) }), vi.fn());
		await resetKickPollMissCounters(db, []);
		expect(run).not.toHaveBeenCalled();
	});

	it('resets miss counters for broadcasters still live', async () => {
		const run = vi.fn();
		const db = mockIngestD1(
			() => ({
				bind: () => ({
					run,
					first: async () => null,
				}),
			}),
			vi.fn(),
		);
		await kickBroadcasterIdsReadyToClose(db, ['1', '2'], new Set(['1']));
		expect(run).toHaveBeenCalled();
	});

	it('closes broadcaster after consecutive offline poll threshold', async () => {
		const meta = new Map<string, string>([['kick_poll_miss:99', '2']]);
		const db = mockIngestD1(
			(sql: string) => ({
				bind: (...args: unknown[]) => ({
					first: async () => {
						const key = String(args[0]);
						const value = meta.get(key);
						return value != null ? { value } : null;
					},
					run: async () => {
						if (sql.includes('INSERT INTO ingest_metadata')) {
							meta.set(String(args[0]), String(args[1]));
						}
						if (sql.includes('DELETE FROM ingest_metadata') && !sql.includes('json_each')) {
							meta.delete(String(args[0]));
						}
						return {};
					},
				}),
			}),
			vi.fn(),
		);

		const toClose = await kickBroadcasterIdsReadyToClose(db, ['99'], new Set());
		expect(toClose).toEqual(['99']);
		expect(meta.has('kick_poll_miss:99')).toBe(false);
		expect(KICK_OFFLINE_MISS_THRESHOLD).toBe(3);
	});
});
