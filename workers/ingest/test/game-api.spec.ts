import { describe, it, expect } from 'vitest';
import {
	buildGameDetailResponse,
	buildGameTopChannels,
	parseGameDetailQuery
} from '../src/ranking/game-api';

describe('parseGameDetailQuery', () => {
	it('parses slug from path and defaults', () => {
		const url = new URL('http://x/v1/games/valorant?platform=twitch&period=30d');
		const q = parseGameDetailQuery(url);
		expect(q.slug).toBe('valorant');
		expect(q.platform).toBe('twitch');
		expect(q.period).toBe('30d');
	});
});

describe('buildGameDetailResponse', () => {
	it('returns null for unknown slug', async () => {
		const db = {
			prepare() {
				return {
					bind: () => ({ first: async () => null })
				};
			}
		} as unknown as D1Database;

		const res = await buildGameDetailResponse(db, {
			platform: 'twitch',
			slug: 'missing',
			period: '7d'
		});
		expect(res).toBeNull();
	});

	it('aggregates rollups into totals and daily series', async () => {
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM game_categories')) {
					return {
						bind: () => ({
							first: async () => ({
								id: 'game-1',
								slug: 'valorant',
								name: 'VALORANT'
							})
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
										hours_watched: 100,
										average_viewers: 50,
										peak_viewers: 200,
										airtime_minutes: 600,
										live_channels: 10
									},
									{
										date: '2026-05-30',
										hours_watched: 200,
										average_viewers: 80,
										peak_viewers: 300,
										airtime_minutes: 300,
										live_channels: 15
									}
								]
							})
						})
					};
				}
				return { bind: () => ({ first: async () => null, all: async () => ({}) }) };
			}
		} as unknown as D1Database;

		const res = await buildGameDetailResponse(db, {
			platform: 'twitch',
			slug: 'valorant',
			period: '7d'
		});

		expect(res).toMatchObject({
			slug: 'valorant',
			name: 'VALORANT',
			totals: {
				hours_watched: 300,
				peak_viewers: 300,
				live_channels: 15
			}
		});
		expect(res!.daily).toHaveLength(2);
		expect(res!.top_channels).toEqual([]);
	});

	it('includes top_channels ranked by hours watched', async () => {
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM game_categories')) {
					return {
						bind: () => ({
							first: async () => ({
								id: 'game-1',
								slug: 'valorant',
								name: 'VALORANT'
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
						bind: () => ({
							all: async () => ({
								results: [
									{
										slug: 'shroud',
										display_name: 'shroud',
										avatar_url: 'https://example/a.png',
										hours_watched: 5000
									},
									{
										slug: 'tarik',
										display_name: 'tarik',
										avatar_url: null,
										hours_watched: 1200
									}
								]
							})
						})
					};
				}
				return { bind: () => ({ first: async () => null, all: async () => ({}) }) };
			}
		} as unknown as D1Database;

		const res = await buildGameDetailResponse(
			db,
			{ platform: 'twitch', slug: 'valorant', period: '7d' },
			{ minAirtimeMinutes: 60 }
		);

		expect(res?.top_channels).toEqual([
			{
				rank: 1,
				slug: 'shroud',
				display_name: 'shroud',
				avatar_url: 'https://example/a.png',
				hours_watched: 5000
			},
			{
				rank: 2,
				slug: 'tarik',
				display_name: 'tarik',
				avatar_url: null,
				hours_watched: 1200
			}
		]);
	});

	it('buildGameTopChannels returns empty for youtube', async () => {
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

	it('resolves case-insensitive slug', async () => {
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM game_categories') && sql.includes('lower(slug)')) {
					return {
						bind: (_platform: string, slug: string) => ({
							first: async () => ({
								id: 'game-1',
								slug: 'VALORANT',
								name: 'VALORANT'
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
				return { bind: () => ({ first: async () => null, all: async () => ({}) }) };
			}
		} as unknown as D1Database;

		const res = await buildGameDetailResponse(db, {
			platform: 'twitch',
			slug: 'valorant',
			period: '7d'
		});

		expect(res?.slug).toBe('VALORANT');
	});
});
