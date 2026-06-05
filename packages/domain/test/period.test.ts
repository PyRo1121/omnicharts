import { describe, expect, test } from 'bun:test';
import {
	comparePeriods,
	isRankingPeriod,
	parseComparePeriod,
	parseRankingPeriod,
	periodCoverageNote,
	periodToDays,
	rankingPeriods,
	uiRankingPeriods
} from '../src/period';

describe('ranking periods', () => {
	test('rankingPeriods lists all windows', () => {
		expect(rankingPeriods).toEqual(['24h', '7d', '30d', '90d']);
	});

	test('isRankingPeriod narrows valid values', () => {
		expect(isRankingPeriod('7d')).toBe(true);
		expect(isRankingPeriod('365d')).toBe(false);
	});

	test('parseRankingPeriod defaults invalid input to 7d', () => {
		expect(parseRankingPeriod(null)).toBe('7d');
		expect(parseRankingPeriod('bad')).toBe('7d');
		expect(parseRankingPeriod('30d')).toBe('30d');
	});

	test('periodToDays maps windows', () => {
		expect(periodToDays('24h')).toBe(1);
		expect(periodToDays('7d')).toBe(7);
		expect(periodToDays('30d')).toBe(30);
		expect(periodToDays('90d')).toBe(90);
	});

	test('uiRankingPeriods exposes 90d in Phase 4', () => {
		expect(uiRankingPeriods).toEqual(['24h', '7d', '30d', '90d']);
	});

	test('comparePeriods excludes 24h', () => {
		expect(comparePeriods).toEqual(['7d', '30d', '90d']);
	});

	test('parseComparePeriod defaults invalid input to 7d', () => {
		expect(parseComparePeriod(null)).toBe('7d');
		expect(parseComparePeriod('24h')).toBe('7d');
		expect(parseComparePeriod('90d')).toBe('90d');
	});

	test('periodCoverageNote when history shorter than requested window', () => {
		expect(periodCoverageNote('90d', 45)).toContain('45 days');
		expect(periodCoverageNote('90d', 90)).toBeNull();
		expect(periodCoverageNote('7d', null)).toBeNull();
	});
});
