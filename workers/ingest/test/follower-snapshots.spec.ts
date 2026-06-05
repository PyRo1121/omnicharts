import { describe, it, expect, vi } from 'vitest';
import { mockIngestD1 } from './helpers';
import {
	computeFollowersDelta,
	fetchFollowerCountsByChannelId,
	fetchPriorFollowerSnapshots,
	storeFollowerSnapshots,
} from '../src/db/follower-snapshots';

/** D1 bind cap is below stock SQLite 999; keep batches conservative. */
const D1_MAX_BIND_VARIABLES = 50;

function mockDbCountingInQueries() {
	const bindArgCounts: number[] = [];
	const db = {
		prepare(sql: string) {
			return {
				bind(...args: unknown[]) {
					if (sql.includes(' IN (')) bindArgCounts.push(args.length);
					return {
						all: async () => ({ results: [] as { id: string; follower_count: number | null }[] }),
					};
				},
			};
		},
	};
	return { db, bindArgCounts };
}

describe('fetchFollowerCountsByChannelId', () => {
	it('batches IN queries so bind count stays under SQLite limit', async () => {
		const ids = Array.from({ length: 2500 }, (_, i) => `ch-${i}`);
		const { db, bindArgCounts } = mockDbCountingInQueries();

		await fetchFollowerCountsByChannelId(db, ids);

		expect(bindArgCounts.length).toBeGreaterThan(1);
		for (const n of bindArgCounts) {
			expect(n).toBeLessThanOrEqual(D1_MAX_BIND_VARIABLES);
		}
	});
});

describe('fetchPriorFollowerSnapshots', () => {
	it('batches metadata IN queries under SQLite variable limit', async () => {
		const ids = Array.from({ length: 2500 }, (_, i) => `ch-${i}`);
		const { db, bindArgCounts } = mockDbCountingInQueries();

		await fetchPriorFollowerSnapshots(db, ids);

		expect(bindArgCounts.length).toBeGreaterThan(1);
		for (const n of bindArgCounts) {
			expect(n).toBeLessThanOrEqual(D1_MAX_BIND_VARIABLES);
		}
	});
});

describe('storeFollowerSnapshots', () => {
	it('writes metadata via DB.batch in chunks of 50', async () => {
		const batch = vi.fn().mockResolvedValue([]);
		const prepare = vi.fn((sql: string) => ({
			bind: (...args: unknown[]) => ({ sql, args }),
		}));
		const db = mockIngestD1((sql) => prepare(sql), batch);
		const snapshots = new Map(Array.from({ length: 75 }, (_, i) => [`ch-${i}`, 1000 + i] as const));

		await storeFollowerSnapshots(db, snapshots);

		expect(batch).toHaveBeenCalledTimes(2);
		expect(batch.mock.calls[0][0]).toHaveLength(50);
		expect(batch.mock.calls[1][0]).toHaveLength(25);
	});
});

describe('computeFollowersDelta', () => {
	it('returns difference when both counts exist', () => {
		expect(computeFollowersDelta(1050, 1000)).toBe(50);
	});

	it('returns null when either count is missing', () => {
		expect(computeFollowersDelta(null, 1000)).toBeNull();
		expect(computeFollowersDelta(1000, null)).toBeNull();
	});
});
