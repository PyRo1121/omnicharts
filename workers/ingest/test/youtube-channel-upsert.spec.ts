import { describe, it, expect } from 'vitest';
import { upsertYoutubeChannel } from '../src/db/youtube-channel';

describe('upsertYoutubeChannel', () => {
	it('inserts discovered YouTube channel row', async () => {
		const binds: unknown[][] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => ({
						first: async () => null,
						run: async () => {
							binds.push([sql, ...args]);
						},
					}),
				};
			},
		} as unknown as D1Database;

		const row = await upsertYoutubeChannel(db, {
			platformChannelId: 'UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
			displayName: 'MrBeast',
			avatarUrl: 'https://example.com/avatar.jpg',
		});

		expect(row).toEqual({
			id: 'youtube-ch-UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
			created: true,
		});
		expect(binds[0]?.[0]).toContain('INSERT INTO channels');
		expect(binds[0]).toContain('discovered');
	});

	it('updates existing YouTube channel row', async () => {
		const binds: unknown[][] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => ({
						first: async () => {
							if (sql.includes('SELECT id, slug')) {
								return { id: 'youtube-ch-UCabcdefghijklmnopqrstuv', slug: 'old-slug' };
							}
							return null;
						},
						run: async () => {
							binds.push([sql, ...args]);
						},
					}),
				};
			},
		} as unknown as D1Database;

		const row = await upsertYoutubeChannel(db, {
			platformChannelId: 'UCabcdefghijklmnopqrstuv',
			slug: 'mrbeast',
			displayName: 'MrBeast',
			avatarUrl: null,
		});

		expect(row.created).toBe(false);
		expect(binds.some(([sql]) => String(sql).includes('UPDATE channels SET'))).toBe(true);
	});
});
