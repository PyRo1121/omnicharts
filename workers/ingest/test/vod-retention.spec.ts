import { describe, it, expect } from 'vitest';
import {
	isVideoWithinRetention,
	parseIso8601DurationMs,
	vodRetentionDaysForBroadcasterType,
	vodSessionTimes
} from '../src/twitch/vod-retention';

describe('vodRetentionDaysForBroadcasterType', () => {
	it('returns 60 for partner', () => {
		expect(vodRetentionDaysForBroadcasterType('partner')).toBe(60);
	});

	it('returns 14 for affiliate', () => {
		expect(vodRetentionDaysForBroadcasterType('affiliate')).toBe(14);
	});

	it('returns 7 for default or empty', () => {
		expect(vodRetentionDaysForBroadcasterType('')).toBe(7);
		expect(vodRetentionDaysForBroadcasterType(null)).toBe(7);
		expect(vodRetentionDaysForBroadcasterType('')).toBe(7);
	});
});

describe('isVideoWithinRetention', () => {
	const now = Date.parse('2026-06-05T12:00:00.000Z');

	it('accepts video inside partner window', () => {
		expect(
			isVideoWithinRetention('2026-05-10T00:00:00.000Z', 60, now)
		).toBe(true);
	});

	it('rejects video outside default window', () => {
		expect(
			isVideoWithinRetention('2026-05-20T00:00:00.000Z', 7, now)
		).toBe(false);
	});

	it('rejects invalid published_at', () => {
		expect(isVideoWithinRetention('not-a-date', 7, now)).toBe(false);
	});
});

describe('parseIso8601DurationMs', () => {
	it('parses PT1H2M3S', () => {
		expect(parseIso8601DurationMs('PT1H2M3S')).toBe(3_723_000);
	});

	it('returns null for invalid duration', () => {
		expect(parseIso8601DurationMs('1h')).toBeNull();
	});
});

describe('vodSessionTimes', () => {
	it('derives ended_at from duration', () => {
		const times = vodSessionTimes(
			{ created_at: '2026-06-01T10:00:00.000Z', duration: 'PT2H30M' },
			Date.parse('2026-06-05T12:00:00.000Z')
		);
		expect(times.started_at).toBe('2026-06-01T10:00:00.000Z');
		expect(times.ended_at).toBe('2026-06-01T12:30:00.000Z');
	});
});
