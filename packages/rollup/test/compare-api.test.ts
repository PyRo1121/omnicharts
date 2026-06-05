import { describe, expect, test } from 'bun:test';
import {
	buildCompareChannelsResponse,
	parseCompareChannelsQuery
} from '../src/compare-api';

describe('parseCompareChannelsQuery', () => {
	test('requires both slug query params', () => {
		const url = new URL('http://localhost/v1/compare/channels?platform=twitch&period=7d');
		expect(parseCompareChannelsQuery(url)).toEqual({ ok: false, error: 'missing_slugs' });
	});

	test('rejects invalid platform', () => {
		const url = new URL(
			'http://localhost/v1/compare/channels?a=ninja&b=shroud&platform=invalid&period=7d'
		);
		expect(parseCompareChannelsQuery(url)).toEqual({ ok: false, error: 'invalid_platform' });
	});

	test('defaults compare period to 7d', () => {
		const url = new URL('http://localhost/v1/compare/channels?a=ninja&b=shroud&platform=twitch');
		expect(parseCompareChannelsQuery(url)).toEqual({
			ok: true,
			platform: 'twitch',
			period: '7d',
			a: 'ninja',
			b: 'shroud'
		});
	});

	test('accepts 30d and 90d compare periods', () => {
		const url = new URL(
			'http://localhost/v1/compare/channels?a=ninja&b=shroud&platform=kick&period=90d'
		);
		expect(parseCompareChannelsQuery(url)).toEqual({
			ok: true,
			platform: 'kick',
			period: '90d',
			a: 'ninja',
			b: 'shroud'
		});
	});

	test('maps unknown period to 7d', () => {
		const url = new URL(
			'http://localhost/v1/compare/channels?a=ninja&b=shroud&platform=twitch&period=24h'
		);
		expect(parseCompareChannelsQuery(url)).toEqual({
			ok: true,
			platform: 'twitch',
			period: '7d',
			a: 'ninja',
			b: 'shroud'
		});
	});

	test('trims slug whitespace', () => {
		const url = new URL(
			'http://localhost/v1/compare/channels?a=%20ninja%20&b=shroud%20&platform=twitch'
		);
		expect(parseCompareChannelsQuery(url)).toEqual({
			ok: true,
			platform: 'twitch',
			period: '7d',
			a: 'ninja',
			b: 'shroud'
		});
	});
});

describe('buildCompareChannelsResponse', () => {
	function mockCompareDb(opts?: { missingSlug?: string }): D1Database {
		return {
			prepare(sql: string) {
				if (sql.includes('lower(slug)')) {
					return {
						bind: (_platform: string, slug: string) => ({
							first: async () =>
								opts?.missingSlug === slug ? null : { slug }
						})
					};
				}
				if (sql.includes('FROM channels') && sql.includes('display_name')) {
					return {
						bind: (_platform: string, slug: string) => ({
							first: async () => ({
								id: `id-${slug}`,
								slug,
								display_name: slug,
								avatar_url: null,
								language: 'en',
								first_observed_at: '2026-01-01T00:00:00Z',
								ingest_state: 'tracked',
								follower_count: 100,
								description: null
							}),
							all: async () => ({ results: [] })
						})
					};
				}
				if (sql.includes('channel_daily_rollups')) {
					return {
						bind: () => ({
							all: async () => ({
								results: [
									{
										date: '2026-06-01',
										hours_watched: 100,
										average_viewers: 10,
										peak_viewers: 20,
										airtime_minutes: 60,
										stream_count: 1,
										followers_delta: 1
									}
								]
							})
						})
					};
				}
				return { bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }) };
			}
		} as unknown as D1Database;
	}

	test('returns both channels when present', async () => {
		const body = await buildCompareChannelsResponse(mockCompareDb(), {
			platform: 'twitch',
			period: '7d',
			a: 'ninja',
			b: 'shroud'
		});

		expect(body.platform).toBe('twitch');
		expect(body.period).toBe('7d');
		expect(body.a.slug).toBe('ninja');
		expect(body.b.slug).toBe('shroud');
		expect(body.a.found).toBe(true);
		expect(body.b.found).toBe(true);
	});

	test('marks missing channel as not found', async () => {
		const body = await buildCompareChannelsResponse(
			mockCompareDb({ missingSlug: 'missing' }),
			{
				platform: 'twitch',
				period: '7d',
				a: 'ninja',
				b: 'missing'
			}
		);

		expect(body.a.found).toBe(true);
		expect(body.b.found).toBe(false);
		expect(body.b.slug).toBe('missing');
	});
});
