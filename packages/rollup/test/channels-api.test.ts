import { describe, it, expect, vi, afterEach } from 'bun:test';
import * as topChannels from '../src/top-channels';
import {
	buildRankingsChannelsResponse,
	parseRankingsChannelsQuery
} from '../src/channels-api';

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

	it('accepts platform=kick', () => {
		const url = new URL('http://x/v1/rankings/channels?platform=kick');
		const q = parseRankingsChannelsQuery(url);
		expect(q.ok).toBe(true);
		if (!q.ok) return;
		expect(q.platform).toBe('kick');
	});

	it('rejects invalid platform', () => {
		const url = new URL('http://x/v1/rankings/channels?platform=facebook');
		expect(parseRankingsChannelsQuery(url)).toEqual({ ok: false, error: 'invalid_platform' });
	});

	it('rejects invalid period', () => {
		const url = new URL('http://x/v1/rankings/channels?period=365d');
		expect(parseRankingsChannelsQuery(url)).toEqual({ ok: false, error: 'invalid_period' });
	});
});

describe('buildRankingsChannelsResponse', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('queries kick rollups via platform-agnostic top channels', async () => {
		const spy = vi.spyOn(topChannels, 'getTopChannelsByHoursWatched').mockResolvedValue([
			{
				rank: 1,
				slug: 'xqc',
				displayName: 'xQc',
				avatarUrl: null,
				hoursWatched: 5000,
				averageViewers: 200,
				peakViewers: 1000,
				airtimeHours: 25,
				streamCount: 4,
				trackedSince: '2026-04-01T00:00:00.000Z'
			}
		]);

		const res = await buildRankingsChannelsResponse({} as D1Database, {
			platform: 'kick',
			period: '7d',
			limit: 20
		});

		expect(spy).toHaveBeenCalledWith(
			{},
			expect.objectContaining({ platformId: 'kick', days: 7, limit: 20 })
		);
		expect(res.platform).toBe('kick');
		expect(res.items[0]).toMatchObject({
			rank: 1,
			slug: 'xqc',
			hours_watched: 5000,
			average_viewers: 200
		});
	});

	it('maps twitch rankings to API shape', async () => {
		vi.spyOn(topChannels, 'getTopChannelsByHoursWatched').mockResolvedValue([
			{
				rank: 1,
				slug: 'alpha',
				displayName: 'Alpha',
				avatarUrl: 'https://example.com/a.png',
				hoursWatched: 1000.4,
				averageViewers: 50.6,
				peakViewers: 500,
				airtimeHours: 12.5,
				streamCount: 3,
				trackedSince: '2026-03-01T00:00:00.000Z'
			}
		]);

		const res = await buildRankingsChannelsResponse({} as D1Database, {
			platform: 'twitch',
			period: '7d',
			limit: 20
		});

		expect(res.items[0]).toMatchObject({
			rank: 1,
			slug: 'alpha',
			hours_watched: 1000,
			average_viewers: 51,
			peak_viewers: 500,
			airtime_hours: 12.5,
			stream_count: 3,
			tracked_since: '2026-03-01T00:00:00.000Z'
		});
	});

	it('queries 90-day rollups when period is 90d', async () => {
		const spy = vi.spyOn(topChannels, 'getTopChannelsByHoursWatched').mockResolvedValue([]);

		await buildRankingsChannelsResponse({} as D1Database, {
			platform: 'youtube',
			period: '90d',
			limit: 20
		});

		expect(spy).toHaveBeenCalledWith(
			{},
			expect.objectContaining({ platformId: 'youtube', days: 90, limit: 20 })
		);
	});

	it('uses platform-specific min viewers from env', async () => {
		const spy = vi.spyOn(topChannels, 'getTopChannelsByHoursWatched').mockResolvedValue([]);

		await buildRankingsChannelsResponse(
			{} as D1Database,
			{ platform: 'kick', period: '7d', limit: 20 },
			{ KICK_MIN_VIEWERS: 50, TWITCH_MIN_VIEWERS: 2 }
		);

		expect(spy).toHaveBeenCalledWith(
			{},
			expect.objectContaining({ platformId: 'kick', minAverageViewers: 50 })
		);
	});
});
