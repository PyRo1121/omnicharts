import { describe, it, expect } from 'vitest';
import { upsertKickChannelFromLookup, upsertTwitchChannelFromUser } from '../src/watchlist/upsert';

function createMemoryDb() {
	const channels = new Map<
		string,
		{
			id: string;
			platform_id: string;
			platform_channel_id: string;
			slug: string;
			display_name: string;
			ingest_state: string;
		}
	>();

	const db = {
		prepare: (sql: string) => ({
			bind: (...args: unknown[]) => ({
				first: async () => {
					if (sql.includes('lower(slug) = lower')) {
						const platform = args[0] as string;
						const slug = (args[1] as string).toLowerCase();
						for (const row of channels.values()) {
							if (row.platform_id === platform && row.slug.toLowerCase() === slug) {
								return { id: row.id, ingest_state: row.ingest_state, slug: row.slug };
							}
						}
						return null;
					}
					if (sql.includes('platform_channel_id = ?')) {
						const platform = args[0] as string;
						const platformChannelId = args[1] as string;
						for (const row of channels.values()) {
							if (row.platform_id === platform && row.platform_channel_id === platformChannelId) {
								return { id: row.id, ingest_state: row.ingest_state };
							}
						}
						return null;
					}
					return null;
				},
				run: async () => {
					if (!sql.includes('INSERT INTO channels')) return {};
					const id = args[0] as string;
					const platform_id = args[1] as string;
					const platform_channel_id = args[2] as string;
					const slug = args[3] as string;
					const display_name = args[4] as string;
					const ingest_state = 'tracked';

					const existing = [...channels.values()].find(
						(row) => row.platform_id === platform_id && row.platform_channel_id === platform_channel_id,
					);

					if (existing && sql.includes('ON CONFLICT')) {
						existing.slug = slug;
						existing.display_name = display_name;
						if (existing.ingest_state !== 'retired') {
							existing.ingest_state = 'tracked';
						}
					} else {
						channels.set(id, {
							id,
							platform_id,
							platform_channel_id,
							slug,
							display_name,
							ingest_state,
						});
					}
					return {};
				},
			}),
		}),
	} as unknown as D1Database;

	return { db, channels };
}

describe('watchlist upsert', () => {
	it('upsertTwitchChannelFromUser creates tracked row', async () => {
		const { db } = createMemoryDb();
		const result = await upsertTwitchChannelFromUser(db, {
			id: '123',
			login: 'ninja',
			display_name: 'Ninja',
			type: '',
			broadcaster_type: 'partner',
			description: '',
			profile_image_url: 'https://example.com/ninja.jpg',
			created_at: '2011-01-01T00:00:00Z',
		});

		expect(result.created).toBe(true);
		expect(result.promoted).toBe(false);
		expect(result.skipped).toBe(false);
	});

	it('upsertTwitchChannelFromUser promotes discovered row', async () => {
		const { db, channels } = createMemoryDb();
		channels.set('twitch-ch-123', {
			id: 'twitch-ch-123',
			platform_id: 'twitch',
			platform_channel_id: '123',
			slug: 'ninja',
			display_name: 'Ninja',
			ingest_state: 'discovered',
		});

		const result = await upsertTwitchChannelFromUser(db, {
			id: '123',
			login: 'ninja',
			display_name: 'Ninja',
			type: '',
			broadcaster_type: 'partner',
			description: '',
			profile_image_url: 'https://example.com/ninja.jpg',
			created_at: '2011-01-01T00:00:00Z',
		});

		expect(result.promoted).toBe(true);
		expect(result.skipped).toBe(false);
	});

	it('upsertKickChannelFromLookup creates tracked row', async () => {
		const { db } = createMemoryDb();
		const result = await upsertKickChannelFromLookup(db, {
			broadcaster_user_id: 42,
			channel_id: 1,
			slug: 'newkick',
		});

		expect(result.created).toBe(true);
		expect(result.skipped).toBe(false);
	});

	it('upsertKickChannelFromLookup promotes discovered row', async () => {
		const { db, channels } = createMemoryDb();
		channels.set('kick-ch-42', {
			id: 'kick-ch-42',
			platform_id: 'kick',
			platform_channel_id: '42',
			slug: 'newkick',
			display_name: 'newkick',
			ingest_state: 'discovered',
		});

		const result = await upsertKickChannelFromLookup(db, {
			broadcaster_user_id: 42,
			channel_id: 1,
			slug: 'newkick',
		});

		expect(result.promoted).toBe(true);
	});

	it('upsertTwitchChannelFromUser skips already tracked row', async () => {
		const { db, channels } = createMemoryDb();
		channels.set('twitch-ch-123', {
			id: 'twitch-ch-123',
			platform_id: 'twitch',
			platform_channel_id: '123',
			slug: 'ninja',
			display_name: 'Ninja',
			ingest_state: 'tracked',
		});

		const result = await upsertTwitchChannelFromUser(db, {
			id: '123',
			login: 'ninja',
			display_name: 'Ninja',
			type: '',
			broadcaster_type: 'partner',
			description: '',
			profile_image_url: null,
			created_at: '2011-01-01T00:00:00Z',
		});

		expect(result.skipped).toBe(true);
	});

	it('upsertKickChannelFromLookup skips tracked row', async () => {
		const { db, channels } = createMemoryDb();
		channels.set('kick-ch-99', {
			id: 'kick-ch-99',
			platform_id: 'kick',
			platform_channel_id: '99',
			slug: 'xqc',
			display_name: 'xqc',
			ingest_state: 'tracked',
		});

		const result = await upsertKickChannelFromLookup(db, {
			broadcaster_user_id: 99,
			channel_id: 1,
			slug: 'xqc',
		});

		expect(result.skipped).toBe(true);
		expect(result.promoted).toBe(false);
	});
});
