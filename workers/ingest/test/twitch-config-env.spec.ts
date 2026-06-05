import { describe, it, expect } from 'vitest';
import { DEFAULT_LIVE_SWEEP_MAX_PAGES, ingestCoverageModeFromEnv } from '../src/twitch/config';
import { liveSweepMaxPagesFromEnv } from '../src/twitch/helix-budget';

describe('twitch config env', () => {
	it('defaults LIVE_SWEEP_MAX_PAGES to production cap in full mode', () => {
		expect(liveSweepMaxPagesFromEnv({ INGEST_COVERAGE_MODE: 'full' } as Env)).toBe(
			DEFAULT_LIVE_SWEEP_MAX_PAGES
		);
	});

	it('parses LIVE_SWEEP_MAX_PAGES override', () => {
		expect(liveSweepMaxPagesFromEnv({ LIVE_SWEEP_MAX_PAGES: '3' } as Env)).toBe(3);
	});

	it('defaults INGEST_COVERAGE_MODE to full', () => {
		expect(ingestCoverageModeFromEnv({} as Env)).toBe('full');
	});

	it('accepts shards_only and sweep_only', () => {
		expect(ingestCoverageModeFromEnv({ INGEST_COVERAGE_MODE: 'shards_only' } as Env)).toBe(
			'shards_only'
		);
		expect(ingestCoverageModeFromEnv({ INGEST_COVERAGE_MODE: 'sweep_only' } as Env)).toBe(
			'sweep_only'
		);
	});
});
