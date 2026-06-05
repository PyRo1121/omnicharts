import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HelixChannel, HelixUser } from '../src/twitch/helix';
import {
	helixChannelProfileJson,
	mergeUserAndChannelProfile
} from '../src/twitch/profile-fields';
import {
	applyChannelProfileEnrichment,
	listPlatformIdsForProfileEnrichment
} from '../src/db/twitch';
import { runTwitchProfileEnrichment } from '../src/twitch/enrich-profiles';
import { TwitchHelixClient } from '../src/twitch/helix';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const usersFixture = JSON.parse(
	readFileSync(join(fixtureDir, 'fixtures/helix-users-sample.json'), 'utf8')
) as { data: HelixUser[] };
const channelsFixture = JSON.parse(
	readFileSync(join(fixtureDir, 'fixtures/helix-channels-sample.json'), 'utf8')
) as { data: HelixChannel[] };

describe('helix profile field mapping', () => {
	it('serializes channel profile JSON from fixture', () => {
		const channel = channelsFixture.data[0]!;
		expect(JSON.parse(helixChannelProfileJson(channel))).toEqual({
			game_id: '509658',
			game_name: 'Just Chatting',
			title: 'Offline channel title',
			tags: ['日本語', 'English'],
			is_branded_content: false
		});
	});

	it('merges user + channel into enrichment row', () => {
		const user = usersFixture.data[0]!;
		const channel = channelsFixture.data[0]!;
		expect(mergeUserAndChannelProfile(user, channel, 1_234_567)).toEqual({
			platform_channel_id: '545050196',
			display_name: 'KatoJunichi',
			avatar_url: user.profile_image_url,
			description: 'Speedrunner and variety streamer.',
			broadcaster_type: 'affiliate',
			platform_created_at: '2018-03-15T10:20:30Z',
			channel_profile_json: helixChannelProfileJson(channel),
			follower_count: 1_234_567
		});
	});

	it('omits empty description', () => {
		const user = { ...usersFixture.data[0]!, description: '   ' };
		const row = mergeUserAndChannelProfile(user, undefined);
		expect(row.description).toBeNull();
		expect(row.channel_profile_json).toBeNull();
	});
});

describe('applyChannelProfileEnrichment', () => {
	it('updates channels with Tier B columns', async () => {
		const updates: unknown[][] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => {
						if (sql.includes('UPDATE channels SET')) updates.push(args);
						return { run: async () => ({}) };
					}
				};
			}
		} as unknown as D1Database;

		const user = usersFixture.data[0]!;
		const channel = channelsFixture.data[0]!;
		const row = mergeUserAndChannelProfile(user, channel);
		await applyChannelProfileEnrichment(db, row);

		expect(updates).toHaveLength(1);
		expect(updates[0]![0]).toBe('KatoJunichi');
		expect(updates[0]![1]).toContain('profile');
		expect(updates[0]![2]).toBe('Speedrunner and variety streamer.');
		expect(updates[0]![3]).toBe('affiliate');
		expect(updates[0]![4]).toBe('2018-03-15T10:20:30Z');
		expect(updates[0]![5]).toContain('Just Chatting');
		expect(typeof updates[0]![6]).toBe('string');
	});
});

describe('listPlatformIdsForProfileEnrichment', () => {
	it('queries stale tracked channels', async () => {
		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => ({
						all: async () => {
							expect(sql).toContain('profile_enriched_at');
							expect(args[0]).toBe('twitch');
							return { results: [{ platform_channel_id: '545050196' }] };
						}
					})
				};
			}
		} as unknown as D1Database;

		const ids = await listPlatformIdsForProfileEnrichment(db, 10, 24);
		expect(ids).toEqual(['545050196']);
	});
});

describe('runTwitchProfileEnrichment', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches users and channels in batches and persists', async () => {
		const users = usersFixture.data;
		const channels = channelsFixture.data;
		vi.spyOn(TwitchHelixClient.prototype, 'getUsersByIds').mockResolvedValue(users);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelsByBroadcasterIds').mockResolvedValue(
			channels
		);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelFollowerTotals').mockResolvedValue(
			new Map([
				['545050196', 100],
				['141981764', 200]
			])
		);

		const updates: unknown[][] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => {
						if (sql.includes('UPDATE channels SET')) updates.push(args);
						return { run: async () => ({}) };
					}
				};
			},
			batch: async (statements: { run: () => Promise<unknown> }[]) => {
				for (const stmt of statements) await stmt.run();
			}
		} as unknown as D1Database;

		const stats = await runTwitchProfileEnrichment(
			{ DB: db } as Env,
			{ platformChannelIds: ['545050196', '141981764'] }
		);

		expect(stats).toEqual({
			candidates: 2,
			userBatches: 1,
			channelBatches: 1,
			updated: 2,
			skipped: 0,
			retired: 0
		});
		expect(updates).toHaveLength(2);
	});

	it('loads stale tracked ids when platformChannelIds omitted', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getUsersByIds').mockResolvedValue([]);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelsByBroadcasterIds').mockResolvedValue([]);

		const listCalls: number[] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: () => ({
						all: async () => {
							if (sql.includes('profile_enriched_at')) listCalls.push(1);
							return { results: [] };
						}
					})
				};
			}
		} as unknown as D1Database;

		const stats = await runTwitchProfileEnrichment({ DB: db } as Env);
		expect(listCalls).toHaveLength(1);
		expect(stats.candidates).toBe(0);
	});

	it('retires ids missing from Helix users response', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getUsersByIds').mockResolvedValue([
			usersFixture.data[0]!
		]);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelsByBroadcasterIds').mockResolvedValue([]);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelFollowerTotals').mockResolvedValue(
			new Map([['545050196', 50]])
		);

		const sqlCalls: string[] = [];
		const db = {
			prepare(sql: string) {
				sqlCalls.push(sql);
				return {
					bind: () => ({ run: async () => ({}) })
				};
			},
			batch: async (statements: { run: () => Promise<unknown> }[]) => {
				for (const stmt of statements) await stmt.run();
			}
		} as unknown as D1Database;

		const stats = await runTwitchProfileEnrichment(
			{ DB: db } as Env,
			{ platformChannelIds: ['545050196', '999999999999'] }
		);

		expect(stats.updated).toBe(1);
		expect(stats.retired).toBe(1);
		expect(sqlCalls.some((s) => s.includes("ingest_state = 'retired'"))).toBe(true);
	});

	it('skips follower Helix calls when includeFollowers is false', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getUsersByIds').mockResolvedValue(usersFixture.data);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelsByBroadcasterIds').mockResolvedValue(
			channelsFixture.data
		);
		const followerSpy = vi
			.spyOn(TwitchHelixClient.prototype, 'getChannelFollowerTotals')
			.mockResolvedValue(new Map());

		const db = {
			prepare() {
				return { bind: () => ({ run: async () => ({}) }) };
			},
			batch: async (statements: { run: () => Promise<unknown> }[]) => {
				for (const stmt of statements) await stmt.run();
			}
		} as unknown as D1Database;

		await runTwitchProfileEnrichment(
			{ DB: db } as Env,
			{ platformChannelIds: ['545050196'], includeFollowers: false }
		);

		expect(followerSpy).not.toHaveBeenCalled();
	});
});
