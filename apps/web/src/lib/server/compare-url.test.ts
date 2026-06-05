import { describe, it, expect } from 'vitest';
import { parseComparePeriod } from '@omnicharts/domain';
import { comparePageUrl, parseComparePageParams } from '$lib/compare/url';

describe('comparePageUrl', () => {
	it('builds minimal compare URL', () => {
		expect(
			comparePageUrl({ a: 'ninja', b: 'shroud', platform: 'twitch', period: '7d' })
		).toBe('/compare?a=ninja&b=shroud');
	});

	it('includes platform and period when non-default', () => {
		expect(
			comparePageUrl({ a: 'ninja', b: 'shroud', platform: 'kick', period: '90d' })
		).toBe('/compare?a=ninja&b=shroud&platform=kick&period=90d');
	});
});

describe('parseComparePageParams', () => {
	it('reads slug query params and defaults', () => {
		const params = parseComparePageParams(
			new URL('http://localhost/compare?a=ninja&b=shroud&platform=kick&period=30d')
		);
		expect(params).toEqual({
			a: 'ninja',
			b: 'shroud',
			platform: 'kick',
			period: '30d'
		});
	});
});

describe('parseComparePeriod (compare page)', () => {
	it('rejects 24h for compare', () => {
		expect(parseComparePeriod('24h')).toBe('7d');
		expect(parseComparePeriod('90d')).toBe('90d');
	});
});
