import { describe, it, expect } from 'bun:test';
import {
	buildGameDetailResponse,
	buildGameTopChannels,
	parseGameDetailQuery
} from '../src/game-api';

describe('parseGameDetailQuery', () => {
	it('parses slug from path and defaults', () => {
		const url = new URL('http://x/v1/games/valorant?platform=twitch&period=30d');
		const q = parseGameDetailQuery(url);
		expect(q.slug).toBe('valorant');
		expect(q.platform).toBe('twitch');
		expect(q.period).toBe('30d');
	});

	it('accepts platform=kick', () => {
		const url = new URL('http://x/v1/games/just-chatting?platform=kick');
		const q = parseGameDetailQuery(url);
		expect(q.platform).toBe('kick');
		expect(q.slug).toBe('just-chatting');
	});
});

describe('buildGameDetailResponse', () => {
	it('returns null for empty slug', async () => {
		const db = {} as D1Database;
		const res = await buildGameDetailResponse(db, {
			platform: 'kick',
			slug: '',
			period: '7d'
		});
		expect(res).toBeNull();
	});

	it('aggregates kick game rollups', async () => {
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM game_categories')) {
					return {
						bind: (platform: string, slug: string) => ({
							first: async () => ({
								id: 'kick-game-1',
								slug: 'just-chatting',
								name: 'Just Chatting'
							}),
							_platform: platform,
							_slug: slug
						})
					};
				}
				if (sql.includes('game_daily_rollups')) {
					return {
						bind: () => ({
							all: async () => ({
								results: [
									{
										date: '2026-05-29',
										hours_watched: 500,
										average_viewers: 250,
										peak_viewers: 800,
										airtime_minutes: 240,
										live_channels: 20
									}
								]
							})
						})
					};
				}
				return { bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }) };
			}
		} as unknown as D1Database;

		const res = await buildGameDetailResponse(db, {
			platform: 'kick',
			slug: 'just-chatting',
			period: '7d'
		});

		expect(res).toMatchObject({
			platform: 'kick',
			slug: 'just-chatting',
			name: 'Just Chatting',
			totals: {
				hours_watched: 500,
				peak_viewers: 800,
				live_channels: 20
			}
		});
		expect(res!.daily).toHaveLength(1);
	});

	it('includes kick top_channels ranked by hours watched', async () => {
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM game_categories')) {
					return {
						bind: () => ({
							first: async () => ({
								id: 'kick-game-1',
								slug: 'just-chatting',
								name: 'Just Chatting'
							})
						})
					};
				}
				if (sql.includes('game_daily_rollups')) {
					return {
						bind: () => ({
							all: async () => ({ results: [] })
						})
					};
				}
				if (sql.includes('channel_daily_rollups')) {
					return {
						bind: (platform: string) => ({
							all: async () => ({
								results: [
									{
										slug: 'xqc',
										display_name: 'xQc',
										avatar_url: null,
										hours_watched: 9000
									}
								]
							}),
							_platform: platform
						})
					};
				}
				return { bind: () => ({ first: async () => null, all: async () => ({}) }) };
			}
		} as unknown as D1Database;

		const res = await buildGameDetailResponse(
			db,
			{ platform: 'kick', slug: 'just-chatting', period: '7d' },
			{ minAirtimeMinutes: 60 }
		);

		expect(res?.top_channels).toEqual([
			{
				rank: 1,
				slug: 'xqc',
				display_name: 'xQc',
				avatar_url: null,
				hours_watched: 9000
			}
		]);
	});
});

describe('buildGameTopChannels', () => {
	it('returns empty for youtube when no rollups', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({ all: async () => ({ results: [] }) })
			})
		} as unknown as D1Database;
		const rows = await buildGameTopChannels(db, {
			platform: 'youtube',
			gameSlug: 'valorant',
			period: '7d'
		});
		expect(rows).toEqual([]);
	});
});
