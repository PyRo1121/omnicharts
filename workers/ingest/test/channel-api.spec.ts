import { describe, it, expect } from 'vitest';
import { buildChannelDetailResponse, parseChannelDetailQuery } from '../src/ranking/channel-api';

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
});

describe('buildChannelDetailResponse', () => {
	it('returns null for unknown slug', async () => {
		const db = {
			prepare() {
				return {
					bind: () => ({ first: async () => null })
				};
			}
		} as unknown as D1Database;

		const res = await buildChannelDetailResponse(db, {
			platform: 'twitch',
			slug: 'missing',
			period: '7d'
		});
		expect(res).toBeNull();
	});

	it('aggregates rollups into totals and daily series', async () => {
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM channels')) {
					return {
						bind: () => ({
							first: async () => ({
								id: 'ch-1',
								slug: 'alpha',
								display_name: 'Alpha',
								avatar_url: null,
								language: 'en',
								first_observed_at: '2026-03-01T00:00:00.000Z',
								ingest_state: 'tracked',
								follower_count: 10_000,
								description: 'bio'
							})
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
										hours_watched: 10,
										average_viewers: 5,
										peak_viewers: 20,
										airtime_minutes: 120,
										stream_count: 1,
										followers_delta: null
									},
									{
										date: '2026-05-30',
										hours_watched: 20,
										average_viewers: 10,
										peak_viewers: 30,
										airtime_minutes: 60,
										stream_count: 2,
										followers_delta: 5
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
			platform: 'twitch',
			slug: 'alpha',
			period: '7d'
		});

		expect(res).toMatchObject({
			slug: 'alpha',
			follower_count: 10_000,
			totals: {
				hours_watched: 30,
				peak_viewers: 30,
				stream_count: 3,
				followers_gain: 5
			}
		});
		expect(res!.daily).toHaveLength(2);
	});

	it('resolves slug_history before channel lookup', async () => {
		let prepareCalls = 0;
		const db = {
			prepare(sql: string) {
				prepareCalls += 1;
				if (sql.includes('FROM channels') && sql.includes('lower(slug)')) {
					return {
						bind: () => ({
							first: async () => null
						})
					};
				}
				if (sql.includes('slug_history')) {
					return {
						bind: () => ({
							first: async () => ({ new_slug: 'newname' })
						})
					};
				}
				if (sql.includes('FROM channels') && sql.includes('display_name')) {
					return {
						bind: () => ({
							first: async () => ({
								id: 'ch-1',
								slug: 'newname',
								display_name: 'New Name',
								avatar_url: null,
								language: 'en',
								first_observed_at: '2026-03-01T00:00:00.000Z',
								ingest_state: 'tracked',
								follower_count: 100,
								description: null
							})
						})
					};
				}
				if (sql.includes('channel_daily_rollups')) {
					return {
						bind: () => ({
							all: async () => ({ results: [] })
						})
					};
				}
				return { bind: () => ({ first: async () => null, all: async () => ({}) }) };
			}
		} as unknown as D1Database;

		const res = await buildChannelDetailResponse(db, {
			platform: 'twitch',
			slug: 'oldname',
			period: '7d'
		});

		expect(prepareCalls).toBeGreaterThanOrEqual(3);
		expect(res?.slug).toBe('newname');
	});

	it('resolves case-insensitive slug via resolveChannelSlug', async () => {
		const db = {
			prepare(sql: string) {
				if (sql.includes('FROM channels') && sql.includes('lower(slug)')) {
					return {
						bind: () => ({
							first: async () => ({ slug: 'Ninja' })
						})
					};
				}
				if (sql.includes('FROM channels') && sql.includes('display_name')) {
					return {
						bind: (_platform: string, slug: string) => ({
							first: async () => ({
								id: 'ch-1',
								slug,
								display_name: 'Ninja',
								avatar_url: null,
								language: 'en',
								first_observed_at: '2026-03-01T00:00:00.000Z',
								ingest_state: 'tracked',
								follower_count: 100,
								description: null
							})
						})
					};
				}
				if (sql.includes('channel_daily_rollups')) {
					return {
						bind: () => ({
							all: async () => ({ results: [] })
						})
					};
				}
				return { bind: () => ({ first: async () => null, all: async () => ({}) }) };
			}
		} as unknown as D1Database;

		const res = await buildChannelDetailResponse(db, {
			platform: 'twitch',
			slug: 'ninja',
			period: '7d'
		});

		expect(res?.slug).toBe('Ninja');
	});
});
