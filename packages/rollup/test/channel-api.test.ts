import { describe, it, expect } from 'bun:test';
import {
	buildChannelDetailResponse,
	parseChannelDetailQuery
} from '../src/channel-api';

describe('parseChannelDetailQuery', () => {
	it('parses slug from path and defaults', () => {
		const url = new URL('http://x/v1/channels/ninja?platform=twitch&period=30d');
		const q = parseChannelDetailQuery(url);
		expect(q.ok).toBe(true);
		if (!q.ok) return;
		expect(q.slug).toBe('ninja');
		expect(q.platform).toBe('twitch');
		expect(q.period).toBe('30d');
	});

	it('rejects invalid platform', () => {
		const url = new URL('http://x/v1/channels/ninja?platform=facebook');
		expect(parseChannelDetailQuery(url)).toEqual({ ok: false, error: 'invalid_platform' });
	});
});

describe('buildChannelDetailResponse', () => {
	it('returns null for empty slug', async () => {
		const db = {} as D1Database;
		const res = await buildChannelDetailResponse(db, {
			platform: 'twitch',
			slug: '',
			period: '7d'
		});
		expect(res).toBeNull();
	});

	it('aggregates kick channel rollups', async () => {
		const db = {
			prepare(sql: string) {
				if (sql.includes('lower(slug)')) {
					return {
						bind: () => ({
							first: async () => ({ slug: 'xqc' })
						})
					};
				}
				if (sql.includes('FROM channels') && sql.includes('display_name')) {
					return {
						bind: (platform: string, slug: string) => ({
							first: async () => ({
								id: 'kick-ch-1',
								slug,
								display_name: 'xQc',
								avatar_url: null,
								language: 'en',
								first_observed_at: '2026-03-01T00:00:00.000Z',
								ingest_state: 'tracked',
								follower_count: 100_000,
								description: 'kick bio'
							}),
							// platform bind assertion via closure
							_platform: platform
						})
					};
				}
				if (sql.includes('channel_daily_rollups')) {
					return {
						bind: () => ({
							all: async () => ({
								results: [
									{
										date: '2026-05-29',
										hours_watched: 100,
										average_viewers: 50,
										peak_viewers: 200,
										airtime_minutes: 120,
										stream_count: 1,
										followers_delta: null
									}
								]
							})
						})
					};
				}
				return { bind: () => ({ first: async () => null, all: async () => ({}) }) };
			}
		} as unknown as D1Database;

		const res = await buildChannelDetailResponse(db, {
			platform: 'kick',
			slug: 'xqc',
			period: '7d'
		});

		expect(res).toMatchObject({
			platform: 'kick',
			slug: 'xqc',
			display_name: 'xQc',
			totals: {
				hours_watched: 100,
				stream_count: 1
			}
		});
	});
});
