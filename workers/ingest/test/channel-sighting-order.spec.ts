import { describe, it, expect } from 'vitest';
import type { HelixStream } from '../src/twitch/helix';
import { upsertChannelFromStream } from '../src/db/twitch';

const stream: HelixStream = {
	id: '1',
	user_id: '999888777',
	user_login: 'new_streamer',
	user_name: 'New',
	game_id: '509658',
	game_name: 'Just Chatting',
	title: 'Live',
	viewer_count: 500,
	started_at: '2026-06-01T12:00:00Z',
	type: 'live',
};

describe('channel sighting FK order', () => {
	it('records live sighting only after channels upsert', async () => {
		const order: string[] = [];
		const db = {
			prepare(sql: string) {
				if (sql.includes('platform_channel_id IN')) {
					return { bind: () => ({ all: async () => ({ results: [] }) }) };
				}
				if (sql.includes('slug IN')) {
					return { bind: () => ({ all: async () => ({ results: [] }) }) };
				}
				if (sql.includes('GROUP BY channel_id')) {
					return {
						bind: () => ({
							all: async () => ({
								results: [{ channel_id: 'twitch-ch-999888777', n: 1 }],
							}),
						}),
					};
				}
				if (sql.includes('INSERT INTO channel_live_sightings')) {
					return {
						bind: () => ({
							run: async () => {
								order.push('sighting');
								return {};
							},
						}),
					};
				}
				if (sql.includes('DELETE FROM channel_live_sightings')) {
					return { bind: () => ({ run: async () => ({}) }) };
				}
				if (sql.includes('FROM channel_live_sightings') && sql.includes('COUNT')) {
					return {
						bind: () => ({
							all: async () => ({
								results: [{ channel_id: 'twitch-ch-999888777', n: 1 }],
							}),
						}),
					};
				}
				if (sql.includes('INSERT INTO channels')) {
					return {
						bind: () => ({
							run: async () => {
								order.push('channel_upsert');
								return {};
							},
						}),
					};
				}
				if (sql.includes('SELECT id FROM channels')) {
					return {
						bind: () => ({
							first: async () => ({ id: 'twitch-ch-999888777' }),
						}),
					};
				}
				if (sql.includes("ingest_state = 'tracked'")) {
					return { bind: () => ({ run: async () => ({}) }) };
				}
				return { bind: () => ({ run: async () => ({}) }) };
			},
			async batch(statements: { run: () => Promise<unknown> }[]) {
				for (const stmt of statements) await stmt.run();
				return [];
			},
		} as unknown as D1Database;

		await upsertChannelFromStream(db, stream, {
			minViewers: 20,
			promoteToTracked: true,
		});

		expect(order).toEqual(['channel_upsert', 'sighting']);
	});

	it('promotes to tracked via UPDATE after second sighting', async () => {
		const order: string[] = [];
		const db = {
			prepare(sql: string) {
				if (sql.includes('platform_channel_id IN')) {
					return {
						bind: () => ({
							all: async () => ({
								results: [
									{
										id: 'twitch-ch-999888777',
										slug: 'new_streamer',
										ingest_state: 'discovered',
										first_observed_at: '2026-05-01T00:00:00Z',
										platform_channel_id: '999888777',
									},
								],
							}),
						}),
					};
				}
				if (sql.includes('slug IN')) {
					return { bind: () => ({ all: async () => ({ results: [] }) }) };
				}
				if (sql.includes('GROUP BY channel_id')) {
					return {
						bind: () => ({
							all: async () => ({
								results: [{ channel_id: 'twitch-ch-999888777', n: 2 }],
							}),
						}),
					};
				}
				if (sql.includes('INSERT INTO channel_live_sightings')) {
					return {
						bind: () => ({
							run: async () => {
								order.push('sighting');
								return {};
							},
						}),
					};
				}
				if (sql.includes('DELETE FROM channel_live_sightings')) {
					return { bind: () => ({ run: async () => ({}) }) };
				}
				if (sql.includes('FROM channel_live_sightings') && sql.includes('COUNT')) {
					return {
						bind: () => ({
							all: async () => ({
								results: [{ channel_id: 'twitch-ch-999888777', n: 2 }],
							}),
						}),
					};
				}
				if (sql.includes('INSERT INTO channels')) {
					return {
						bind: () => ({
							run: async () => {
								order.push('channel_upsert');
								return {};
							},
						}),
					};
				}
				if (sql.includes('SELECT id FROM channels')) {
					return {
						bind: () => ({
							first: async () => ({ id: 'twitch-ch-999888777' }),
						}),
					};
				}
				if (sql.includes("ingest_state = 'tracked'")) {
					return {
						bind: () => ({
							run: async () => {
								order.push('promote_tracked');
								return {};
							},
						}),
					};
				}
				return { bind: () => ({ run: async () => ({}) }) };
			},
			async batch(statements: { run: () => Promise<unknown> }[]) {
				for (const stmt of statements) await stmt.run();
				return [];
			},
		} as unknown as D1Database;

		await upsertChannelFromStream(db, stream, {
			minViewers: 20,
			promoteToTracked: true,
		});

		expect(order).toEqual(['channel_upsert', 'sighting', 'promote_tracked']);
	});
});
