import { describe, it, expect } from 'vitest';
import { resolveRollupDate } from '../src/rollup/daily-job';
import { utcDayEndExclusiveIso, utcDayStartIso, yesterdayUtcDateString, toUtcDateString } from '../src/rollup/dates';

describe('rollup dates', () => {
	it('resolveRollupDate accepts explicit YYYY-MM-DD', () => {
		expect(resolveRollupDate('2026-05-30')).toBe('2026-05-30');
	});

	it('resolveRollupDate defaults to yesterday UTC', () => {
		expect(resolveRollupDate(undefined)).toBe(yesterdayUtcDateString());
	});

	it('toUtcDateString is ISO date prefix', () => {
		expect(toUtcDateString(new Date('2026-05-30T23:59:59.000Z'))).toBe('2026-05-30');
	});

	it('utc day range bounds cover one UTC calendar day', () => {
		expect(utcDayStartIso('2026-05-30')).toBe('2026-05-30T00:00:00.000Z');
		expect(utcDayEndExclusiveIso('2026-05-30')).toBe('2026-05-31T00:00:00.000Z');
	});
});
