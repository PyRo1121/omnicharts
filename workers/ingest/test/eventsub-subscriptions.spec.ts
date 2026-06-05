import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listTrackedBroadcasterIds, markEventSubRevoked, upsertEventSubSubscription } from '../src/twitch/eventsub/subscriptions-db';
import { TwitchEventSubApi } from '../src/twitch/eventsub/subscriptions-api';
import { syncTwitchEventSubSubscriptions } from '../src/twitch/eventsub/sync';
import { deleteEventSubForRetiredChannels } from '../src/twitch/eventsub/retire-cleanup';

vi.mock('../src/twitch/auth', () => ({
	getAppAccessToken: vi.fn().mockResolvedValue('test-token'),
}));

describe('EventSub subscriptions db', () => {
	it('upsert and revoke update D1', async () => {
		const sql: string[] = [];
		const db = {
			prepare(q: string) {
				sql.push(q);
				return { bind: () => ({ run: async () => ({}) }) };
			},
		} as unknown as D1Database;

		await upsertEventSubSubscription(db, {
			id: 'sub-1',
			eventType: 'stream.online',
			broadcasterUserId: '123',
			status: 'enabled',
		});
		await markEventSubRevoked(db, 'sub-1', 'user_removed');
		expect(sql.some((s) => s.includes('INSERT INTO twitch_eventsub_subscriptions'))).toBe(true);
		expect(sql.some((s) => s.includes('UPDATE twitch_eventsub_subscriptions'))).toBe(true);
	});

	it('listTrackedBroadcasterIds returns ids', async () => {
		const db = {
			prepare() {
				return {
					bind: () => ({
						all: async () => ({ results: [{ platform_channel_id: '42' }] }),
					}),
				};
			},
		} as unknown as D1Database;
		expect(await listTrackedBroadcasterIds(db, 10)).toEqual(['42']);
	});
});

describe('TwitchEventSubApi', () => {
	const env = {
		TWITCH_CLIENT_ID: 'id',
		TWITCH_CLIENT_SECRET: 'sec',
		TWITCH_EVENTSUB_SECRET: 's3cre77890ab',
		TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/hook',
	} as Env;

	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.includes('/eventsub/subscriptions') && init?.method === 'POST') {
					return Promise.resolve(
						new Response(
							JSON.stringify({
								data: [{ id: 'new-sub', type: 'stream.online', status: 'enabled' }],
								total: 1,
								total_cost: 1,
								max_total_cost: 10000,
							}),
							{ status: 200 },
						),
					);
				}
				if (url.includes('/eventsub/subscriptions')) {
					return Promise.resolve(
						new Response(
							JSON.stringify({
								data: [],
								total: 0,
								total_cost: 0,
								max_total_cost: 10000,
							}),
							{ status: 200 },
						),
					);
				}
				return Promise.resolve(new Response('bad', { status: 500 }));
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('listSubscriptions returns parsed JSON', async () => {
		const api = new TwitchEventSubApi(env);
		const page = await api.listSubscriptions({ status: 'enabled' });
		expect(page.total).toBe(0);
	});

	it('createSubscription handles already_exists', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('exists', { status: 409 })));
		const api = new TwitchEventSubApi(env);
		const created = await api.createSubscription({
			type: 'stream.online',
			broadcasterUserId: '123',
			callbackUrl: env.TWITCH_EVENTSUB_CALLBACK_URL!,
			secret: env.TWITCH_EVENTSUB_SECRET!,
		});
		expect(created.status).toBe('already_exists');
		vi.unstubAllGlobals();
	});

	it('createSubscription posts condition payload', async () => {
		const api = new TwitchEventSubApi(env);
		const created = await api.createSubscription({
			type: 'stream.online',
			broadcasterUserId: '123',
			callbackUrl: env.TWITCH_EVENTSUB_CALLBACK_URL!,
			secret: env.TWITCH_EVENTSUB_SECRET!,
		});
		expect(created.subscriptionId).toBe('new-sub');
	});
});

describe('syncTwitchEventSubSubscriptions', () => {
	it('returns error when EventSub env missing', async () => {
		const stats = await syncTwitchEventSubSubscriptions({ DB: {} } as Env);
		expect(stats.errors).toBe(1);
		expect(stats.errorSamples[0]).toMatch(/TWITCH_EVENTSUB/);
	});

	it('creates missing lifecycle subs for tracked broadcasters', async () => {
		const db = {
			prepare(sql: string) {
				return {
					bind: () => {
						if (sql.includes('SELECT platform_channel_id')) {
							return { all: async () => ({ results: [{ platform_channel_id: '123' }] }) };
						}
						if (sql.includes('ingest_metadata')) {
							return { first: async () => null, run: async () => ({}) };
						}
						return { run: async () => ({}) };
					},
				};
			},
		} as unknown as D1Database;

		vi.spyOn(TwitchEventSubApi.prototype, 'listAllEnabled').mockResolvedValue([]);
		vi.spyOn(TwitchEventSubApi.prototype, 'createSubscription').mockResolvedValue({
			subscriptionId: 'sub-new',
			status: 'enabled',
		});

		const stats = await syncTwitchEventSubSubscriptions({
			DB: db,
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'sec',
			TWITCH_EVENTSUB_SECRET: 's3cre77890ab',
			TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/hook',
			TWITCH_MAX_TRACKED: '10',
		} as Env);

		expect(stats.trackedChannels).toBe(1);
		expect(stats.created).toBeGreaterThan(0);
	});

	it('returns stats without throwing when listAllEnabled fails', async () => {
		const db = {
			prepare(sql: string) {
				return {
					bind: () => {
						if (sql.includes('SELECT platform_channel_id')) {
							return { all: async () => ({ results: [{ platform_channel_id: '123' }] }) };
						}
						if (sql.includes('ingest_metadata')) {
							return { first: async () => null, run: async () => ({}) };
						}
						return { run: async () => ({}) };
					},
				};
			},
		} as unknown as D1Database;

		vi.spyOn(TwitchEventSubApi.prototype, 'listAllEnabled').mockRejectedValue(new Error('EventSub list 503: upstream'));
		const createSpy = vi.spyOn(TwitchEventSubApi.prototype, 'createSubscription');

		const stats = await syncTwitchEventSubSubscriptions({
			DB: db,
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'sec',
			TWITCH_EVENTSUB_SECRET: 's3cre77890ab',
			TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/hook',
			TWITCH_MAX_TRACKED: '10',
		} as Env);

		expect(stats.errors).toBe(1);
		expect(stats.errorSamples[0]).toMatch(/listAllEnabled/);
		expect(stats.created).toBe(0);
		expect(createSpy).not.toHaveBeenCalled();
	});

	it('respects per-run create cap and advances cursor', async () => {
		const ids = ['a', 'b', 'c'];
		let savedCursor = '0';
		const db = {
			prepare(q: string) {
				return {
					bind: (...args: unknown[]) => {
						if (q.includes('SELECT platform_channel_id')) {
							return {
								all: async () => ({
									results: ids.map((id) => ({ platform_channel_id: id })),
								}),
							};
						}
						if (q.includes('SELECT value FROM ingest_metadata')) {
							return { first: async () => ({ value: savedCursor }) };
						}
						if (q.includes('INSERT INTO ingest_metadata')) {
							return {
								run: async () => {
									savedCursor = String(args[1]);
									return {};
								},
							};
						}
						return { run: async () => ({}) };
					},
				};
			},
		} as unknown as D1Database;

		vi.spyOn(TwitchEventSubApi.prototype, 'listAllEnabled').mockResolvedValue([]);
		const createSpy = vi
			.spyOn(TwitchEventSubApi.prototype, 'createSubscription')
			.mockResolvedValue({ subscriptionId: 'sub-new', status: 'enabled' });

		await syncTwitchEventSubSubscriptions({
			DB: db,
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'sec',
			TWITCH_EVENTSUB_SECRET: 's3cre77890ab',
			TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/hook',
			TWITCH_MAX_TRACKED: '10',
			EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN: '1',
		} as Env);

		expect(createSpy).toHaveBeenCalledTimes(2);
		expect(savedCursor).toBe('1');
	});

	it('upserts local row when create returns already_exists', async () => {
		const sql: string[] = [];
		const db = {
			prepare(q: string) {
				sql.push(q);
				return {
					bind: () => {
						if (q.includes('SELECT platform_channel_id')) {
							return { all: async () => ({ results: [{ platform_channel_id: '123' }] }) };
						}
						if (q.includes('SELECT id, event_type FROM twitch_eventsub_subscriptions')) {
							return { all: async () => ({ results: [] }) };
						}
						if (q.includes('ingest_metadata')) {
							return { first: async () => null, run: async () => ({}) };
						}
						return { run: async () => ({}) };
					},
				};
			},
		} as unknown as D1Database;

		vi.spyOn(TwitchEventSubApi.prototype, 'listAllEnabled').mockResolvedValue([]);
		vi.spyOn(TwitchEventSubApi.prototype, 'createSubscription').mockResolvedValue({
			subscriptionId: null,
			status: 'already_exists',
		});
		vi.spyOn(TwitchEventSubApi.prototype, 'findEnabledSubscription').mockImplementation(async (type, broadcasterUserId) => ({
			id: `existing-${type}`,
			type,
			version: '1',
			status: 'enabled',
			cost: 1,
			condition: { broadcaster_user_id: broadcasterUserId },
			transport: { method: 'webhook', callback: 'https://example.com/hook' },
			created_at: '2026-01-01T00:00:00Z',
		}));

		const stats = await syncTwitchEventSubSubscriptions({
			DB: db,
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'sec',
			TWITCH_EVENTSUB_SECRET: 's3cre77890ab',
			TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/hook',
			TWITCH_MAX_TRACKED: '10',
		} as Env);

		expect(stats.skippedExisting).toBeGreaterThan(0);
		expect(stats.errors).toBe(0);
		expect(sql.some((s) => s.includes('INSERT INTO twitch_eventsub_subscriptions'))).toBe(true);
	});

	it('backfills local DB from remote when subs exist but local is empty', async () => {
		const sql: string[] = [];
		const db = {
			prepare(q: string) {
				sql.push(q);
				return {
					bind: () => {
						if (q.includes('SELECT platform_channel_id')) {
							return { all: async () => ({ results: [{ platform_channel_id: '123' }] }) };
						}
						if (q.includes('SELECT id, event_type FROM twitch_eventsub_subscriptions')) {
							return { all: async () => ({ results: [] }) };
						}
						if (q.includes('ingest_metadata')) {
							return { first: async () => null, run: async () => ({}) };
						}
						return { run: async () => ({}) };
					},
				};
			},
		} as unknown as D1Database;

		vi.spyOn(TwitchEventSubApi.prototype, 'listAllEnabled').mockResolvedValue([
			{
				id: 'remote-on',
				type: 'stream.online',
				version: '1',
				status: 'enabled',
				cost: 1,
				condition: { broadcaster_user_id: '123' },
				transport: { method: 'webhook', callback: 'https://example.com/hook' },
				created_at: '2026-01-01T00:00:00Z',
			},
			{
				id: 'remote-off',
				type: 'stream.offline',
				version: '1',
				status: 'enabled',
				cost: 1,
				condition: { broadcaster_user_id: '123' },
				transport: { method: 'webhook', callback: 'https://example.com/hook' },
				created_at: '2026-01-01T00:00:00Z',
			},
		]);
		const createSpy = vi.spyOn(TwitchEventSubApi.prototype, 'createSubscription');

		const stats = await syncTwitchEventSubSubscriptions({
			DB: db,
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'sec',
			TWITCH_EVENTSUB_SECRET: 's3cre77890ab',
			TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/hook',
			TWITCH_MAX_TRACKED: '10',
		} as Env);

		expect(stats.created).toBe(0);
		expect(stats.skippedExisting).toBe(2);
		expect(createSpy).not.toHaveBeenCalled();
		expect(sql.filter((s) => s.includes('INSERT INTO twitch_eventsub_subscriptions'))).toHaveLength(2);
	});
});

describe('deleteEventSubForRetiredChannels', () => {
	it('deletes remote and local subs for retired broadcaster', async () => {
		const sql: string[] = [];
		const db = {
			prepare(q: string) {
				sql.push(q);
				return {
					bind: () => ({
						all: async () =>
							q.includes('SELECT id, event_type')
								? {
										results: [
											{ id: 'sub-on', event_type: 'stream.online' },
											{ id: 'sub-off', event_type: 'stream.offline' },
										],
									}
								: { results: [] },
						run: async () => ({}),
					}),
				};
			},
		} as unknown as D1Database;

		const deleteSpy = vi.spyOn(TwitchEventSubApi.prototype, 'deleteSubscription').mockResolvedValue(undefined);

		const deleted = await deleteEventSubForRetiredChannels(
			{
				DB: db,
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'sec',
				TWITCH_EVENTSUB_SECRET: 's3cre77890ab',
				TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/hook',
			} as Env,
			['999'],
		);

		expect(deleted).toBe(2);
		expect(deleteSpy).toHaveBeenCalledTimes(2);
		expect(sql.some((s) => s.includes('DELETE FROM twitch_eventsub_subscriptions'))).toBe(true);
	});

	it('no-ops when EventSub not configured', async () => {
		const deleteSpy = vi.spyOn(TwitchEventSubApi.prototype, 'deleteSubscription');
		const deleted = await deleteEventSubForRetiredChannels({ DB: {} } as Env, ['999']);
		expect(deleted).toBe(0);
		expect(deleteSpy).not.toHaveBeenCalled();
	});
});
