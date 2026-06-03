import { describe, it, expect } from 'vitest';
import { buildIngestHealth, ingestHealthHttpStatus } from '../src/health/status';
import { healthStatusFromLag } from '../src/health/operational-metrics';

function mockEnv(overrides: Partial<Env> = {}): Env {
	let batchCalls = 0;
	const db = {
		prepare(_sql: string) {
			const stmt = {
				async first<T>(): Promise<T | null> {
					return {} as T;
				},
				bind() {
					return stmt;
				}
			};
			return stmt;
		},
		async batch() {
			batchCalls += 1;
			if (batchCalls === 1) {
				return [
					{ results: [{ ok: 1 }] },
					{ results: [{ value: '2026-05-31T00:15:00.000Z' }] },
					{ results: [{ ingest_state: 'tracked', n: 42 }] },
					{ results: [{ value: '{"at":"2026-06-01T00:00:00.000Z"}' }] }
				];
			}
			return [
				{ results: [{ n: 5 }] },
				{ results: [{ n: 2 }] },
				{ results: [{ max_sampled_at: new Date().toISOString() }] }
			];
		}
	} as unknown as D1Database;

	return {
		DB: db,
		TWITCH_CLIENT_ID: 'id',
		TWITCH_CLIENT_SECRET: 'secret',
		...overrides
	} as Env;
}

describe('buildIngestHealth', () => {
	it('returns ok when db and twitch configured', async () => {
		const payload = await buildIngestHealth(mockEnv());
		expect(payload.status).toBe('ok');
		expect(payload.last_rollup_at).toBe('2026-05-31T00:15:00.000Z');
		expect(payload.tracked_channels.twitch).toBe(42);
		expect(payload.ingest_state_counts.twitch.tracked).toBe(42);
		expect(payload.channels_live).toBe(5);
		expect(payload.discovery_new_24h).toBe(2);
		expect(payload.ingest_lag_seconds.twitch).toBeLessThan(5);
		expect(ingestHealthHttpStatus(payload)).toBe(200);
	});

	it('marks degraded when ingest lag exceeds threshold', () => {
		expect(healthStatusFromLag('ok', 301)).toBe('degraded');
		expect(healthStatusFromLag('ok', 60)).toBe('ok');
	});

	it('returns unavailable without credentials', async () => {
		const payload = await buildIngestHealth(
			mockEnv({ TWITCH_CLIENT_ID: undefined, TWITCH_CLIENT_SECRET: undefined })
		);
		expect(payload.status).toBe('unavailable');
		expect(ingestHealthHttpStatus(payload)).toBe(503);
	});
});
