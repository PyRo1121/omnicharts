import { describe, expect, test } from 'vitest';
import { INGEST_STATE_TRACKED } from '@omnicharts/domain';
import { countFromBatchRow, maxSampleFromBatchRow } from '../src/d1';
import { formatCompactMetric, formatHoursWatched } from '../src/format';
import {
	LIVE_COUNT_RECENT_SAMPLE_MINUTES,
	TWITCH_DISCOVERY_24H_SQL,
	TWITCH_LIVE_COUNT_SQL,
	TWITCH_MAX_SAMPLE_SQL,
	TWITCH_TRACKED_COUNT_SQL,
} from '../src/operational-sql';

describe('operational SQL constants', () => {
	test('live count window matches doc default', () => {
		expect(LIVE_COUNT_RECENT_SAMPLE_MINUTES).toBe(5);
	});

	test('TWITCH_LIVE_COUNT_SQL requires open session and recent sample', () => {
		expect(TWITCH_LIVE_COUNT_SQL).toContain('ss.ended_at IS NULL');
		expect(TWITCH_LIVE_COUNT_SQL).toContain(`datetime('now', '-${LIVE_COUNT_RECENT_SAMPLE_MINUTES} minutes')`);
	});

	test('TWITCH_TRACKED_COUNT_SQL uses domain ingest state constant', () => {
		expect(TWITCH_TRACKED_COUNT_SQL).toContain(`ingest_state = '${INGEST_STATE_TRACKED}'`);
	});

	test('TWITCH_DISCOVERY_24H_SQL filters first_observed_at', () => {
		expect(TWITCH_DISCOVERY_24H_SQL).toContain('first_observed_at');
	});

	test('TWITCH_MAX_SAMPLE_SQL joins samples to twitch channels', () => {
		expect(TWITCH_MAX_SAMPLE_SQL).toContain('MAX(vs.sampled_at)');
		expect(TWITCH_MAX_SAMPLE_SQL).toContain('platform_id = ?');
	});
});

describe('countFromBatchRow', () => {
	test('reads n from first batch row', () => {
		expect(countFromBatchRow({ results: [{ n: 42 }] })).toBe(42);
		expect(countFromBatchRow({ results: [] })).toBe(0);
	});
});

describe('maxSampleFromBatchRow', () => {
	test('reads max_sampled_at from first batch row', () => {
		expect(maxSampleFromBatchRow({ results: [{ max_sampled_at: '2026-01-01' }] })).toBe('2026-01-01');
		expect(maxSampleFromBatchRow({ results: [] })).toBeNull();
	});
});

describe('format helpers', () => {
	test('formatHoursWatched compacts large values', () => {
		expect(formatHoursWatched(2_173_869)).toBe('2.17M');
		expect(formatHoursWatched(12_500)).toBe('12.5K');
		expect(formatHoursWatched(842)).toBe('842');
	});

	test('formatCompactMetric matches hours formatter', () => {
		expect(formatCompactMetric(1_500)).toBe('1.5K');
	});
});
