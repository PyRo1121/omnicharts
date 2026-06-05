import { describe, it, expect } from 'vitest';
import { testEnv } from './helpers';
import { DEFAULT_LIVE_SWEEP_MAX_PAGES, ingestCoverageModeFromEnv } from '../src/twitch/config';
import { liveSweepMaxPagesFromEnv } from '../src/twitch/helix-budget';

describe('twitch config env', () => {
	it('defaults LIVE_SWEEP_MAX_PAGES to production cap in full mode', () => {
		expect(liveSweepMaxPagesFromEnv(testEnv({ INGEST_COVERAGE_MODE: 'full' }))).toBe(DEFAULT_LIVE_SWEEP_MAX_PAGES);
	});

	it('parses LIVE_SWEEP_MAX_PAGES override', () => {
		expect(liveSweepMaxPagesFromEnv(testEnv({ LIVE_SWEEP_MAX_PAGES: '3' }))).toBe(3);
	});

	it('defaults INGEST_COVERAGE_MODE to full', () => {
		expect(ingestCoverageModeFromEnv(testEnv())).toBe('full');
	});

	it('accepts shards_only and sweep_only', () => {
		expect(ingestCoverageModeFromEnv(testEnv({ INGEST_COVERAGE_MODE: 'shards_only' }))).toBe('shards_only');
		expect(ingestCoverageModeFromEnv(testEnv({ INGEST_COVERAGE_MODE: 'sweep_only' }))).toBe('sweep_only');
	});
});
