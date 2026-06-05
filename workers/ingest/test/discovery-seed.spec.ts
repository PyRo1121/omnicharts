import { describe, it, expect } from 'vitest';
import { recordDiscoverySeed, getDiscoverySeedAt } from '../src/discovery/seed';

describe('discovery seed metadata', () => {
	it('records and reads discovery_seed_at', async () => {
		const store = new Map<string, string>();
		const db = {
			prepare(_sql: string) {
				return {
					bind(key: string, value?: string) {
						if (_sql.includes('INSERT')) {
							return {
								run: async () => {
									store.set(key, value!);
									return {};
								},
							};
						}
						return {
							first: async () => (store.has(key) ? { value: store.get(key)! } : null),
						};
					},
				};
			},
		} as unknown as D1Database;

		await recordDiscoverySeed(db, {
			gamesScanned: 5,
			pagesFetched: 10,
			streamsSeen: 100,
			channelsUpserted: 20,
		});

		const at = await getDiscoverySeedAt(db);
		expect(at).toBeTruthy();
	});
});
