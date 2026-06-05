import { describe, it, expect } from 'vitest';
import { parseRankingPeriod, periodToDays } from '../src/ranking/period';

describe('parseRankingPeriod', () => {
	it('defaults to 7d', () => {
		expect(parseRankingPeriod(null)).toBe('7d');
	});

	it('accepts 24h, 7d, 30d, 90d', () => {
		expect(parseRankingPeriod('30d')).toBe('30d');
	});

	it('falls back unknown to 7d', () => {
		expect(parseRankingPeriod('14d')).toBe('7d');
	});
});

describe('periodToDays', () => {
	it('maps period tokens to day counts', () => {
		expect(periodToDays('7d')).toBe(7);
		expect(periodToDays('30d')).toBe(30);
		expect(periodToDays('24h')).toBe(1);
	});
});
