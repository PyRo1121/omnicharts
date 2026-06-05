import { describe, it, expect, vi } from 'vitest';
import * as sessionLifecycle from '../src/db/session-lifecycle';
import {
	kickPlatformStreamId,
	kickPlatformStreamIdFromChannelId,
	kickSessionRowId,
	kickSessionRowIdFromChannelId
} from '../src/kick/stream-fields';
import {
	applyKickLivestreamStatusUpdated,
	parseLivestreamStatusUpdated
} from '../src/kick/webhook/lifecycle';
import type { KickLivestreamStatusUpdatedEvent } from '../src/kick/webhook/types';

const sampleStream = {
	broadcaster_user_id: 42,
	channel_id: 99,
	slug: 'caster',
	stream_title: 'Live',
	started_at: '2026-06-01T12:00:00Z'
};

describe('kick webhook lifecycle vs poll session keys', () => {
	it('webhook and poll share platform_stream_id and session row id', () => {
		expect(kickPlatformStreamId(sampleStream)).toBe('99-2026-06-01T12:00:00Z');
		expect(kickSessionRowId(sampleStream)).toBe('kick-sess-99-20260601120000');

		const event: KickLivestreamStatusUpdatedEvent = {
			broadcaster: {
				user_id: 42,
				channel_slug: 'caster',
				channel_id: 99
			},
			channel_id: 99,
			is_live: true,
			started_at: '2026-06-01T12:00:00Z',
			title: 'Live'
		};

		expect(kickPlatformStreamIdFromChannelId(99, event.started_at!)).toBe(
			kickPlatformStreamId(sampleStream)
		);
		expect(kickSessionRowIdFromChannelId(99, event.started_at!)).toBe(
			kickSessionRowId(sampleStream)
		);
	});

	it('applyKickLivestreamStatusUpdated upserts poll-aligned session row and closes stale sessions', async () => {
		const sessionInserts: { sessionId: string; platformStreamId: string }[] = [];
		const closeStale = vi
			.spyOn(sessionLifecycle, 'closeStaleOpenSessionsForChannel')
			.mockResolvedValue(undefined);

		const db = {
			prepare(sql: string) {
				if (sql.includes('INSERT INTO channels')) {
					return { bind: () => ({ run: async () => ({}) }) };
				}
				if (sql.includes('SELECT id FROM channels')) {
					return {
						bind: () => ({ first: async () => ({ id: 'kick-ch-42' }) })
					};
				}
				if (sql.includes('INSERT INTO ingest_metadata')) {
					return { bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) };
				}
				if (sql.includes('SELECT value FROM ingest_metadata')) {
					return { bind: () => ({ first: async () => null }) };
				}
				if (sql.includes('INSERT INTO stream_sessions')) {
					return {
						bind: (
							sessionId: string,
							_channelId: string,
							platformStreamId: string
						) => ({
							run: async () => {
								sessionInserts.push({ sessionId, platformStreamId });
							}
						})
					};
				}
				return { bind: () => ({ run: async () => ({}) }) };
			}
		} as unknown as D1Database;

		await applyKickLivestreamStatusUpdated(
			{ DB: db } as Env,
			{
				broadcaster: { user_id: 42, channel_slug: 'caster', channel_id: 99 },
				channel_id: 99,
				is_live: true,
				started_at: '2026-06-01T12:00:00Z',
				title: 'Live'
			}
		);

		expect(sessionInserts).toHaveLength(1);
		expect(sessionInserts[0]).toEqual({
			sessionId: kickSessionRowId(sampleStream),
			platformStreamId: kickPlatformStreamId(sampleStream)
		});
		expect(closeStale).toHaveBeenCalledWith(
			db,
			'kick-ch-42',
			kickPlatformStreamId(sampleStream),
			expect.any(String)
		);
		closeStale.mockRestore();
	});

	it('applyKickLivestreamStatusUpdated closes sessions when stream goes offline', async () => {
		const updates: string[] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: (...args: unknown[]) => ({
						run: async () => {
							if (sql.includes('UPDATE stream_sessions SET ended_at')) {
								updates.push(String(args[0]));
							}
						},
						first: async () => ({ id: 'kick-ch-42' })
					})
				};
			}
		} as unknown as D1Database;

		await applyKickLivestreamStatusUpdated(
			{ DB: db } as Env,
			{
				broadcaster: { user_id: 42, channel_slug: 'caster', channel_id: 99 },
				channel_id: 99,
				is_live: false,
				ended_at: '2026-06-01T14:00:00Z'
			}
		);

		expect(updates).toContain('2026-06-01T14:00:00Z');
	});
});

describe('parseLivestreamStatusUpdated', () => {
	it('returns null for malformed payloads', () => {
		expect(parseLivestreamStatusUpdated(null)).toBeNull();
		expect(parseLivestreamStatusUpdated({ broadcaster: {} })).toBeNull();
		expect(
			parseLivestreamStatusUpdated({
				broadcaster: { user_id: 1, channel_slug: 'x' },
				is_live: 'yes'
			})
		).toBeNull();
	});
});
