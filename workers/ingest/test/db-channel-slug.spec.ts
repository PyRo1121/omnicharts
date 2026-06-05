import { describe, it, expect } from 'vitest';
import { mockIngestD1 } from './helpers';
import type { HelixStream } from '../src/twitch/helix';
import { upsertChannelFromStream } from '../src/db/twitch';

const baseStream: HelixStream = {
	id: '1',
	user_id: '111',
	user_login: 'foo__bar',
	user_name: 'Foo',
	game_id: '1',
	game_name: 'G',
	title: 'T',
	viewer_count: 100,
	started_at: '2026-06-01T00:00:00Z',
	type: 'live',
};

describe('upsertChannelFromStream slug branches', () => {
	it('uses platform id suffix when slug collides with another channel', async () => {
		const binds: unknown[][] = [];
		const db = mockIngestD1(
			(sql) => {
				if (sql.includes('INSERT INTO channels')) {
					return {
						bind: (...args: unknown[]) => {
							binds.push(args);
							return { run: async () => ({}) };
						},
					};
				}
				return {
					bind: (...args: unknown[]) => {
						binds.push(args);
						if (sql.includes('platform_channel_id IN')) {
							return { all: async () => ({ results: [] }) };
						}
						if (sql.includes('slug IN')) {
							return {
								all: async () => ({
									results: [{ slug: 'foo-bar', platform_channel_id: '999' }],
								}),
							};
						}
						return { run: async () => ({}), all: async () => ({ results: [] }) };
					},
				};
			},
			async (statements) => {
				for (const stmt of statements) await stmt.run();
				return [];
			},
		);

		await upsertChannelFromStream(db, baseStream, { minViewers: 10, promoteToTracked: false });
		const insertBind = binds.find((b) => b[2] === '111');
		expect(String(insertBind?.[3])).toBe('foo-bar-111');
	});
});
