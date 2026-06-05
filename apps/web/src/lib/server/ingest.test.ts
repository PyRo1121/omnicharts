import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getIngestBaseUrl', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('uses INGEST_URL when set', async () => {
		vi.doMock('$env/dynamic/private', () => ({ env: { INGEST_URL: 'http://custom:9999' } }));
		const { getIngestBaseUrl } = await import('./ingest');
		expect(getIngestBaseUrl()).toBe('http://custom:9999');
	});

	it('defaults to local wrangler dev port', async () => {
		vi.doMock('$env/dynamic/private', () => ({ env: {} }));
		const { getIngestBaseUrl } = await import('./ingest');
		expect(getIngestBaseUrl()).toBe('http://127.0.0.1:8787');
	});
});
