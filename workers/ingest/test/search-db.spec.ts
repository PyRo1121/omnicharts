import { describe, it, expect, vi } from 'vitest';
import { searchChannels } from '../src/search/channels';

describe('searchChannels (D1 mock)', () => {
	it('returns empty for short query without D1 prepare', async () => {
		const prepare = vi.fn();
		const db = { prepare } as unknown as D1Database;
		expect(await searchChannels(db, { platformId: 'twitch', query: 'a' })).toEqual([]);
		expect(prepare).not.toHaveBeenCalled();
	});

	it('queries with prefix LIKE and escaped wildcards', async () => {
		let bound: unknown[] = [];
		const db = {
			prepare(sql: string) {
				expect(sql).toContain("ESCAPE '\\'");
				return {
					bind(...args: unknown[]) {
						bound = args;
						return {
							all: async () => ({
								results: [
									{
										id: '1',
										slug: 'shroud',
										display_name: 'shroud',
										avatar_url: null,
										platform_id: 'twitch',
									},
								],
							}),
						};
					},
				};
			},
		} as unknown as D1Database;

		const rows = await searchChannels(db, { platformId: 'twitch', query: 'shro' });
		expect(rows).toHaveLength(1);
		expect(bound[0]).toBe('twitch');
		expect(bound[2]).toBe('shro%');
	});

	it('escapes LIKE metacharacters in query', async () => {
		let bound: unknown[] = [];
		const db = {
			prepare() {
				return {
					bind(...args: unknown[]) {
						bound = args;
						return { all: async () => ({ results: [] }) };
					},
				};
			},
		} as unknown as D1Database;

		await searchChannels(db, { platformId: 'twitch', query: '100%_' });
		expect(bound[2]).toBe('100\\%\\_%');
		expect(bound[3]).toBe('%100\\%\\_%');
	});

	it('filters by language when provided', async () => {
		let capturedSql = '';
		let bound: unknown[] = [];
		const db = {
			prepare(sql: string) {
				capturedSql = sql;
				return {
					bind(...args: unknown[]) {
						bound = args;
						return { all: async () => ({ results: [] }) };
					},
				};
			},
		} as unknown as D1Database;

		await searchChannels(db, { platformId: 'kick', query: 'xqc', language: 'en' });
		expect(capturedSql).toContain('lower(c.language) = ?');
		expect(bound).toContain('en');
	});
});
