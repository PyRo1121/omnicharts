import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockIngestD1, testEnv } from './helpers';
import { parseHelixChannel, parseHelixListResponse, parseHelixUser } from '../src/json-guards';
import type { HelixChannel, HelixUser } from '../src/twitch/helix';
import { helixChannelProfileJson, mergeUserAndChannelProfile } from '../src/twitch/profile-fields';
import { applyChannelProfileEnrichment, listPlatformIdsForProfileEnrichment } from '../src/db/twitch';
import { runTwitchProfileEnrichment } from '../src/twitch/enrich-profiles';
import { TwitchHelixClient } from '../src/twitch/helix';

const fixtureDir = dirname(fileURLToPath(import.meta.url));

function loadHelixUsersFixture(): HelixUser[] {
	const raw: unknown = JSON.parse(readFileSync(join(fixtureDir, 'fixtures/helix-users-sample.json'), 'utf8'));
	return parseHelixListResponse(raw)
		.data.map(parseHelixUser)
		.filter((user): user is HelixUser => user !== null);
}

function loadHelixChannelsFixture(): HelixChannel[] {
	const raw: unknown = JSON.parse(readFileSync(join(fixtureDir, 'fixtures/helix-channels-sample.json'), 'utf8'));
	return parseHelixListResponse(raw)
		.data.map(parseHelixChannel)
		.filter((channel): channel is HelixChannel => channel !== null);
}

const usersFixture = loadHelixUsersFixture();
const channelsFixture = loadHelixChannelsFixture();

function fixtureUser(index = 0): HelixUser {
	const user = usersFixture[index];
	if (!user) throw new Error('missing helix user fixture');
	return user;
}

function fixtureChannel(index = 0): HelixChannel {
	const channel = channelsFixture[index];
	if (!channel) throw new Error('missing helix channel fixture');
	return channel;
}

describe('helix profile field mapping', () => {
	it('serializes channel profile JSON from fixture', () => {
		const channel = fixtureChannel();
		expect(JSON.parse(helixChannelProfileJson(channel))).toEqual({
			game_id: '509658',
			game_name: 'Just Chatting',
			title: 'Offline channel title',
			tags: ['日本語', 'English'],
			is_branded_content: false,
		});
	});

	it('merges user + channel into enrichment row', () => {
		const user = fixtureUser();
		const channel = fixtureChannel();
		expect(mergeUserAndChannelProfile(user, channel, 1_234_567)).toEqual({
			platform_channel_id: '545050196',
			display_name: 'KatoJunichi',
			avatar_url: user.profile_image_url,
			description: 'Speedrunner and variety streamer.',
			broadcaster_type: 'affiliate',
			platform_created_at: '2018-03-15T10:20:30Z',
			channel_profile_json: helixChannelProfileJson(channel),
			follower_count: 1_234_567,
		});
	});

	it('omits empty description', () => {
		const user = { ...fixtureUser(), description: '   ' };
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
					},
				};
			},
		};

		const user = fixtureUser();
		const channel = fixtureChannel();
		const row = mergeUserAndChannelProfile(user, channel);
		await applyChannelProfileEnrichment(db, row);

		const firstUpdate = updates[0];
		expect(firstUpdate).toBeDefined();
		expect(firstUpdate[0]).toBe('KatoJunichi');
		expect(firstUpdate[1]).toContain('profile');
		expect(firstUpdate[2]).toBe('Speedrunner and variety streamer.');
		expect(firstUpdate[3]).toBe('affiliate');
		expect(firstUpdate[4]).toBe('2018-03-15T10:20:30Z');
		expect(firstUpdate[5]).toContain('Just Chatting');
		expect(typeof firstUpdate[6]).toBe('string');
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
						},
					}),
				};
			},
		};

		const ids = await listPlatformIdsForProfileEnrichment(db, 10, 24);
		expect(ids).toEqual(['545050196']);
	});
});

describe('runTwitchProfileEnrichment', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches users and channels in batches and persists', async () => {
		const users = usersFixture;
		const channels = channelsFixture;
		vi.spyOn(TwitchHelixClient.prototype, 'getUsersByIds').mockResolvedValue(users);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelsByBroadcasterIds').mockResolvedValue(channels);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelFollowerTotals').mockResolvedValue(
			new Map([
				['545050196', 100],
				['141981764', 200],
			]),
		);

		const updates: unknown[][] = [];
		const db = mockIngestD1(
			(sql) => ({
				bind: (...args: unknown[]) => {
					if (sql.includes('UPDATE channels SET')) updates.push(args);
					return { run: async () => ({}) };
				},
			}),
			async (statements) => {
				await Promise.all(statements.map((stmt) => stmt.run()));
			},
		);

		const stats = await runTwitchProfileEnrichment(testEnv({ DB: db }), { platformChannelIds: ['545050196', '141981764'] });

		expect(stats).toEqual({
			candidates: 2,
			userBatches: 1,
			channelBatches: 1,
			updated: 2,
			skipped: 0,
			retired: 0,
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
						},
					}),
				};
			},
		};

		const stats = await runTwitchProfileEnrichment(testEnv({ DB: db }));
		expect(listCalls).toHaveLength(1);
		expect(stats.candidates).toBe(0);
	});

	it('retires ids missing from Helix users response', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getUsersByIds').mockResolvedValue([fixtureUser()]);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelsByBroadcasterIds').mockResolvedValue([]);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelFollowerTotals').mockResolvedValue(new Map([['545050196', 50]]));

		const sqlCalls: string[] = [];
		const db = mockIngestD1(
			(sql) => {
				sqlCalls.push(sql);
				return { bind: () => ({ run: async () => ({}) }) };
			},
			async (statements) => {
				await Promise.all(statements.map((stmt) => stmt.run()));
			},
		);

		const stats = await runTwitchProfileEnrichment(testEnv({ DB: db }), { platformChannelIds: ['545050196', '999999999999'] });

		expect(stats.updated).toBe(1);
		expect(stats.retired).toBe(1);
		expect(sqlCalls.some((s) => s.includes("ingest_state = 'retired'"))).toBe(true);
	});

	it('skips follower Helix calls when includeFollowers is false', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getUsersByIds').mockResolvedValue(usersFixture);
		vi.spyOn(TwitchHelixClient.prototype, 'getChannelsByBroadcasterIds').mockResolvedValue(channelsFixture);
		const followerSpy = vi.spyOn(TwitchHelixClient.prototype, 'getChannelFollowerTotals').mockResolvedValue(new Map());

		const db = mockIngestD1(
			() => ({ bind: () => ({ run: async () => ({}) }) }),
			async (statements) => {
				await Promise.all(statements.map((stmt) => stmt.run()));
			},
		);

		await runTwitchProfileEnrichment(testEnv({ DB: db }), { platformChannelIds: ['545050196'], includeFollowers: false });

		expect(followerSpy).not.toHaveBeenCalled();
	});
});
