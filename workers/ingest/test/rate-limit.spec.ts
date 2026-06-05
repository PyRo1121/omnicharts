import { describe, it, expect, beforeEach } from 'vitest';
import { mockIngestD1, testEnv } from './helpers';
import worker from '../src/index';
import { checkPublicRateLimit, isPublicRateLimitBypassed, resetPublicRateLimitBucketsForTests } from '../src/http/rate-limit';

describe('public rate limit', () => {
	beforeEach(() => {
		resetPublicRateLimitBucketsForTests();
	});

	it('bypasses when ENVIRONMENT is not production', () => {
		expect(isPublicRateLimitBypassed(testEnv())).toBe(true);
	});

	it('returns 429 when production limit exceeded', () => {
		const env = testEnv({
			ENVIRONMENT: 'production',
			INGEST_RATE_LIMIT_PER_MINUTE: '2',
		});
		const req = new Request('http://ingest/v1/rankings/channels', {
			headers: { 'CF-Connecting-IP': '203.0.113.1' },
		});
		expect(checkPublicRateLimit(req, env)).toBeNull();
		expect(checkPublicRateLimit(req, env)).toBeNull();
		const blocked = checkPublicRateLimit(req, env);
		expect(blocked?.status).toBe(429);
	});

	it('does not rate limit GET /health', async () => {
		const env = testEnv({
			ENVIRONMENT: 'production',
			INGEST_RATE_LIMIT_PER_MINUTE: '1',
			DB: mockIngestD1(() => ({
				bind: () => ({
					first: async () => ({}),
				}),
			})),
		});
		const res = await worker.fetch(new Request('http://ingest/health'), env);
		expect(res.status).not.toBe(429);
	});
});
