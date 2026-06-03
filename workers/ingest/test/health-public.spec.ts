import { describe, it, expect } from 'vitest';
import worker from '../src/index';
import { buildPublicHealth } from '../src/health/status';

function mockEnv(): Env {
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
			return [
				{ results: [{ ok: 1 }] },
				{ results: [{ n: 10 }] },
				{ results: [{ n: 2 }] },
				{ results: [{ max_sampled_at: new Date().toISOString() }] }
			];
		}
	} as unknown as D1Database;

	return {
		DB: db,
		TWITCH_CLIENT_ID: 'id',
		TWITCH_CLIENT_SECRET: 'secret'
	} as Env;
}

describe('public health', () => {
	it('buildPublicHealth omits detailed ingest fields', async () => {
		const payload = await buildPublicHealth(mockEnv());
		expect(payload.tracked_channels.twitch).toBe(10);
		expect(payload).not.toHaveProperty('ingest_state_counts');
		expect(payload).not.toHaveProperty('ingest_lag_seconds');
	});

	it('GET /health returns public payload without admin key', async () => {
		const res = await worker.fetch(new Request('http://ingest/health'), mockEnv());
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toHaveProperty('tracked_channels');
		expect(body).not.toHaveProperty('ingest_state_counts');
	});

	it('GET /health?detailed=1 requires admin key', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/health?detailed=1'),
			{ ...mockEnv(), ADMIN_API_KEY: 'secret' } as Env
		);
		expect(res.status).toBe(401);
	});

	it('redirects GET /admin/twitch/rankings to /v1', async () => {
		const res = await worker.fetch(
			new Request('http://ingest/admin/twitch/rankings?period=7d'),
			mockEnv()
		);
		expect(res.status).toBe(308);
		expect(res.headers.get('location')).toContain('/v1/rankings/channels');
	});
});
