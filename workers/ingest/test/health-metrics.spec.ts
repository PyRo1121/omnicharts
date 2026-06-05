import { describe, it, expect } from 'vitest';
import { mockIngestD1 } from './helpers';
import { fetchIngestOperationalMetrics, ingestLagSecondsFromMaxSample } from '../src/health/operational-metrics';

function mockDb(rows: Record<string, number | string | null>): D1Database {
	return mockIngestD1(
		(sql) => ({
			bind: () => ({
				first: async () => {
					if (sql.includes('ended_at IS NULL')) {
						return { n: rows.channels_live ?? 0 };
					}
					if (sql.includes('first_observed_at')) {
						return { n: rows.discovery_new_24h ?? 0 };
					}
					if (sql.includes('MAX(vs.sampled_at)')) {
						return { max_sampled_at: rows.max_sampled_at ?? null };
					}
					return null;
				},
			}),
		}),
		async (stmts) =>
			Promise.all(
				stmts.map(async (stmt) => ({
					results: [await stmt.first()],
				})),
			),
	);
}

describe('ingestLagSecondsFromMaxSample', () => {
	it('returns null when no sample timestamp', () => {
		expect(ingestLagSecondsFromMaxSample(null)).toBeNull();
	});
});

describe('fetchIngestOperationalMetrics', () => {
	it('computes ingest lag from latest sample', async () => {
		const recent = new Date(Date.now() - 42_000).toISOString();
		const metrics = await fetchIngestOperationalMetrics(mockDb({ max_sampled_at: recent }));
		expect(metrics.channels_live).toBe(0);
		expect(metrics.discovery_new_24h).toBe(0);
		expect(metrics.ingest_lag_seconds.twitch).toBeGreaterThanOrEqual(40);
		expect(metrics.ingest_lag_seconds.twitch).toBeLessThan(120);
	});

	it('returns null twitch lag when no samples', async () => {
		const metrics = await fetchIngestOperationalMetrics(mockDb({}));
		expect(metrics.ingest_lag_seconds.twitch).toBeNull();
	});
});
