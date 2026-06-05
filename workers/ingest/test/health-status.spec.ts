import { describe, it, expect } from 'vitest';
import { healthStatusD1, testEnv } from './helpers';
import { buildIngestHealth, ingestHealthHttpStatus } from '../src/health/status';
import { healthStatusFromLag } from '../src/health/operational-metrics';

function mockEnv(overrides: Partial<Env> = {}): Env {
	return testEnv({
		DB: healthStatusD1(),
		TWITCH_CLIENT_ID: 'id',
		TWITCH_CLIENT_SECRET: 'secret',
		...overrides,
	});
}

describe('buildIngestHealth', () => {
	it('returns ok when db and twitch configured', async () => {
		const payload = await buildIngestHealth(mockEnv());
		expect(payload.status).toBe('ok');
		expect(payload.last_rollup_at).toBe('2026-05-31T00:15:00.000Z');
		expect(payload.tracked_channels).toEqual({ twitch: 42, kick: 5, youtube: 2 });
		expect(payload.kick).toBe('missing_credentials');
		expect(payload.youtube).toBe('missing_credentials');
		expect(payload.ingest_state_counts.twitch.tracked).toBe(42);
		expect(payload.channels_live).toBe(5);
		expect(payload.channels_live_by_platform).toEqual({ twitch: 3, kick: 1, youtube: 1 });
		expect(payload.discovery_new_24h).toBe(2);
		expect(payload.ingest_lag_seconds.twitch).toBeLessThan(5);
		expect(ingestHealthHttpStatus(payload)).toBe(200);
	});

	it('marks degraded when ingest lag exceeds threshold', () => {
		expect(healthStatusFromLag('ok', 301)).toBe('degraded');
		expect(healthStatusFromLag('ok', 60)).toBe('ok');
	});

	it('returns unavailable without credentials', async () => {
		const payload = await buildIngestHealth(mockEnv({ TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '' }));
		expect(payload.status).toBe('unavailable');
		expect(ingestHealthHttpStatus(payload)).toBe(503);
	});
});
