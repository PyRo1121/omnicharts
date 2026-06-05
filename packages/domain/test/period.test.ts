import { describe, expect, test } from 'bun:test';
import {
	isRankingPeriod,
	parseRankingPeriod,
	periodToDays,
	rankingPeriods
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
});
