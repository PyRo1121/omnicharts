import { describe, it, expect } from 'vitest';
import { mockIngestD1, pollBatchD1 } from './helpers';
import { KICK_OFFLINE_MISS_THRESHOLD, kickBroadcasterIdsReadyToClose, resetKickPollMissCounters } from '../src/kick/poll-offline-grace';

describe('kick poll offline grace', () => {
	it('resetKickPollMissCounters is a no-op for empty ids', async () => {
		const runs: string[] = [];
		await resetKickPollMissCounters(
			pollBatchD1((sql) => runs.push(sql)),
			[],
		);
		expect(runs).toHaveLength(0);
	});

	it('kickBroadcasterIdsReadyToClose resets counters for live broadcasters', async () => {
		const toClose = await kickBroadcasterIdsReadyToClose(
			pollBatchD1(() => {}),
			['live-1', 'offline-1'],
			new Set(['live-1']),
		);
		expect(toClose).toEqual([]);
	});

	it('kickBroadcasterIdsReadyToClose closes after consecutive offline polls', async () => {
		const db = pollBatchD1(() => {});
		const offlineId = 'offline-99';

		for (let poll = 1; poll < KICK_OFFLINE_MISS_THRESHOLD; poll++) {
			const pending = await kickBroadcasterIdsReadyToClose(db, [offlineId], new Set());
			expect(pending).toEqual([]);
		}

		const ready = await kickBroadcasterIdsReadyToClose(db, [offlineId], new Set());
		expect(ready).toEqual([offlineId]);
	});

	it('kickBroadcasterIdsReadyToClose ignores non-finite miss counters', async () => {
		const meta = new Map<string, string>([['kick_poll_miss:bad', 'not-a-number']]);
		const db = mockIngestD1((sql) => ({
			bind: (...args: unknown[]) => ({
				run: async () => {
					if (sql.includes('INSERT INTO ingest_metadata')) {
						meta.set(String(args[0]), String(args[1]));
					}
					if (sql.includes('DELETE FROM ingest_metadata')) {
						meta.delete(String(args[0]));
					}
					return {};
				},
				first: async () => {
					if (sql.includes('SELECT value FROM ingest_metadata')) {
						const value = meta.get(String(args[0]));
						return value != null ? { value } : null;
					}
					return null;
				},
			}),
		}));

		const result = await kickBroadcasterIdsReadyToClose(db, ['bad'], new Set());
		expect(result).toEqual([]);
	});
});
