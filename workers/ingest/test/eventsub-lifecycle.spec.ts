import { describe, it, expect } from 'vitest';
import { applyStreamOffline, applyStreamOnline } from '../src/twitch/eventsub/lifecycle';
import type { StreamOfflineEvent, StreamOnlineEvent } from '../src/twitch/eventsub/types';

const onlineEvent: StreamOnlineEvent = {
	id: 'stream-1',
	broadcaster_user_id: '123',
	broadcaster_user_login: 'tester',
	broadcaster_user_name: 'Tester',
	type: 'live',
	started_at: '2026-06-01T12:00:00.000Z'
};

const offlineEvent: StreamOfflineEvent = {
	broadcaster_user_id: '123',
	broadcaster_user_login: 'tester',
	broadcaster_user_name: 'Tester'
};

describe('EventSub lifecycle', () => {
	it('applyStreamOnline opens session and closes other open sessions', async () => {
		const sessionUpdates: { sql: string; endedAt?: string }[] = [];

		const db = {
			prepare(sql: string) {
				if (sql.includes('INSERT INTO channels')) {
					return { bind: () => ({ run: async () => ({}) }) };
				}
				if (sql.includes('SELECT id FROM channels')) {
					return {
						bind: () => ({ first: async () => ({ id: 'twitch-ch-123' }) })
					};
				}
				if (sql.includes('INSERT INTO stream_sessions')) {
					return { bind: () => ({ run: async () => ({}) }) };
				}
				if (sql.includes('UPDATE stream_sessions SET ended_at')) {
					return {
						bind: (_endedAt: string, _channelId: string, platformStreamId: string) => ({
							run: async () => {
								sessionUpdates.push({ sql, endedAt: _endedAt });
								expect(platformStreamId).toBe('stream-1');
							}
						})
					};
				}
				return { bind: () => ({ run: async () => ({}) }) };
			}
		} as unknown as D1Database;

		await applyStreamOnline({ DB: db } as Env, onlineEvent);
		expect(sessionUpdates.some((u) => u.sql.includes('ended_at'))).toBe(true);
		expect(sessionUpdates.some((u) => u.endedAt === onlineEvent.started_at)).toBe(true);
	});

	it('applyStreamOffline closes all open sessions for channel', async () => {
		let closed = false;

		const db = {
			prepare(sql: string) {
				if (sql.includes('SELECT id FROM channels')) {
					return {
						bind: () => ({ first: async () => ({ id: 'twitch-ch-123' }) })
					};
				}
				if (sql.includes('UPDATE channels SET last_seen_at')) {
					return { bind: () => ({ run: async () => ({}) }) };
				}
				if (sql.includes('UPDATE stream_sessions SET ended_at') && sql.includes('ended_at IS NULL')) {
					return {
						bind: () => ({
							run: async () => {
								closed = true;
							}
						})
					};
				}
				return { bind: () => ({ run: async () => ({}) }) };
			}
		} as unknown as D1Database;

		await applyStreamOffline({ DB: db } as Env, offlineEvent);
		expect(closed).toBe(true);
	});

	it('applyStreamOffline uses ended_at from event when present', async () => {
		const endedAt = '2026-06-01T18:00:00.000Z';
		const binds: unknown[][] = [];

		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => ({
						first: async () => ({ id: 'twitch-ch-123' }),
						run: async () => {
							binds.push([sql, ...args]);
						}
					})
				};
			}
		} as unknown as D1Database;

		await applyStreamOffline({ DB: db } as Env, { ...offlineEvent, ended_at: endedAt });
		expect(binds.some((row) => row.includes(endedAt))).toBe(true);
	});

	it('applyStreamOffline uses webhook timestamp when event has no ended_at', async () => {
		const endedAt = '2026-06-01T19:00:00.000000000Z';
		const binds: unknown[][] = [];

		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => ({
						first: async () => ({ id: 'twitch-ch-123' }),
						run: async () => {
							binds.push([sql, ...args]);
						}
					})
				};
			}
		} as unknown as D1Database;

		await applyStreamOffline({ DB: db } as Env, offlineEvent, { endedAt });
		expect(binds.some((row) => row.includes(endedAt))).toBe(true);
	});
});
