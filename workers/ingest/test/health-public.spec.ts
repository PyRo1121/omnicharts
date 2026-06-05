import { describe, it, expect } from 'vitest';
import { testEnv } from './helpers';
import worker from '../src/index';
import { buildPublicHealth } from '../src/health/status';

function mockEnv(): Env {
	const db = {
		prepare(_sql: string) {
			const stmt = {
				async first() {
					return null;
				},
				bind() {
					return stmt;
				},
			};
			return stmt;
		},
		async batch(stmts: unknown[]) {
			expect(stmts).toHaveLength(8);
			return [
				{ results: [{ ok: 1 }] },
				{ results: [{ n: 10 }] },
				{ results: [{ n: 4 }] },
				{ results: [{ n: 2 }] },
				{ results: [{ n: 2 }] },
				{ results: [{ n: 1 }] },
				{ results: [{ n: 0 }] },
				{ results: [{ max_sampled_at: new Date().toISOString() }] },
			];
		},
	};

	return testEnv({
		DB: db,
		TWITCH_CLIENT_ID: 'id',
		TWITCH_CLIENT_SECRET: 'secret',
	});
}

describe('public health', () => {
	it('buildPublicHealth omits detailed ingest fields', async () => {
		const payload = await buildPublicHealth(mockEnv());
		expect(payload.tracked_channels).toEqual({ twitch: 10, kick: 4, youtube: 2 });
		expect(payload.kick).toBe('missing_credentials');
		expect(payload.youtube).toBe('missing_credentials');
		expect(payload.eventsub).toBe('not_configured');
		expect(payload).not.toHaveProperty('ingest_state_counts');
		expect(payload).not.toHaveProperty('ingest_lag_seconds');
	});

	it('GET /health returns public payload without admin key', async () => {
		const res = await worker.fetch(new Request('http://ingest/health'), mockEnv());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual(
			expect.objectContaining({
				eventsub: expect.any(String),
				kick: expect.any(String),
				youtube: expect.any(String),
				tracked_channels: expect.any(Object),
			}),
		);
		expect(body).not.toHaveProperty('ingest_state_counts');
	});

	it('GET /health?detailed=1 requires admin key', async () => {
		const res = await worker.fetch(new Request('http://ingest/health?detailed=1'), testEnv({ ...mockEnv(), ADMIN_API_KEY: 'secret' }));
		expect(res.status).toBe(401);
	});

	it('redirects GET /admin/twitch/rankings to /v1', async () => {
		const res = await worker.fetch(new Request('http://ingest/admin/twitch/rankings?period=7d'), mockEnv());
		expect(res.status).toBe(308);
		expect(res.headers.get('location')).toContain('/v1/rankings/channels');
	});
});
