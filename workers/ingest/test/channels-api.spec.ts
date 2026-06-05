import { describe, it, expect, vi } from 'vitest';
import * as rankingQueries from '../../../packages/rollup/src/ranking-queries';
import { buildRankingsChannelsResponse, parseRankingsChannelsQuery } from '../src/ranking/channels-api';

describe('parseRankingsChannelsQuery', () => {
	it('defaults platform twitch and period 7d', () => {
		const url = new URL('http://x/v1/rankings/channels');
		const q = parseRankingsChannelsQuery(url);
		expect(q.ok).toBe(true);
		if (!q.ok) return;
		expect(q.platform).toBe('twitch');
		expect(q.period).toBe('7d');
		expect(q.limit).toBe(20);
	});

	it('rejects invalid period', () => {
		const url = new URL('http://x/v1/rankings/channels?period=365d');
		const q = parseRankingsChannelsQuery(url);
		expect(q).toEqual({ ok: false, error: 'invalid_period' });
	});

	it('rejects NaN limit', () => {
		const url = new URL('http://x/v1/rankings/channels?limit=abc');
		const q = parseRankingsChannelsQuery(url);
		expect(q).toEqual({ ok: false, error: 'invalid_limit' });
	});

	it('rejects invalid platform', () => {
		const url = new URL('http://x/v1/rankings/channels?platform=facebook');
		expect(parseRankingsChannelsQuery(url)).toEqual({ ok: false, error: 'invalid_platform' });
	});
});

describe('buildRankingsChannelsResponse', () => {
	it('maps kick rankings via platform-agnostic query', async () => {
		vi.spyOn(rankingQueries, 'queryTopChannelsByHoursWatched').mockResolvedValue([
			{
				slug: 'xqc',
				display_name: 'xQc',
				avatar_url: null,
				first_observed_at: '2026-04-01T00:00:00.000Z',
				hours_watched: 5000,
				average_viewers: 200,
				airtime_minutes: 1500,
				peak_viewers: 1000,
				stream_count: 4,
			},
		]);

		const res = await buildRankingsChannelsResponse({} as D1Database, {
			platform: 'kick',
			period: '7d',
			limit: 20,
		});

		expect(res.platform).toBe('kick');
		expect(res.items[0]?.slug).toBe('xqc');
		vi.restoreAllMocks();
	});

	it('maps twitch rankings to API shape', async () => {
		vi.spyOn(rankingQueries, 'queryTopChannelsByHoursWatched').mockResolvedValue([
			{
				slug: 'alpha',
				display_name: 'Alpha',
				avatar_url: 'https://example.com/a.png',
				first_observed_at: '2026-03-01T00:00:00.000Z',
				hours_watched: 1000.4,
				average_viewers: 50.6,
				airtime_minutes: 750,
				peak_viewers: 500,
				stream_count: 3,
			},
		]);

		const res = await buildRankingsChannelsResponse({} as D1Database, {
			platform: 'twitch',
			period: '7d',
			limit: 20,
		});

		expect(res.items[0]).toMatchObject({
			rank: 1,
			slug: 'alpha',
			hours_watched: 1000,
			average_viewers: 51,
			peak_viewers: 500,
			airtime_hours: 12.5,
			stream_count: 3,
			tracked_since: '2026-03-01T00:00:00.000Z',
		});
		vi.restoreAllMocks();
	});
});
