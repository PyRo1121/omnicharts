import { describe, it, expect, vi } from 'vitest';
import {
	batchCloseStaleOpenSessionsForChannels,
	closeOpenSessionsForPlatformChannelIds,
	closeStaleOpenSessionsForChannel
} from '../src/db/session-lifecycle';

describe('session-lifecycle', () => {
	it('closeOpenSessionsForPlatformChannelIds batches by platform_channel_id IN subquery', async () => {
		const batch = vi.fn().mockResolvedValue([]);
		const prepare = vi.fn((sql: string) => ({
			sql,
			bind: vi.fn().mockReturnThis()
		}));
		const db = { prepare, batch } as unknown as D1Database;

		const ids = Array.from({ length: 75 }, (_, i) => String(i));
		await closeOpenSessionsForPlatformChannelIds(db, ids, '2026-06-03T00:00:00.000Z', {
			scope: 'test'
		});

		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0][0]).toHaveLength(2);
		expect(prepare.mock.calls[0][0]).toContain('UPDATE stream_sessions SET ended_at');
		expect(prepare.mock.calls[0][0]).toContain('platform_channel_id IN');
	});

	it('closeStaleOpenSessionsForChannel targets mismatched platform_stream_id', async () => {
		const batch = vi.fn().mockResolvedValue([]);
		const prepare = vi.fn((sql: string) => ({
			bind: vi.fn().mockReturnThis(),
			sql
		}));
		const db = { prepare, batch } as unknown as D1Database;

		await closeStaleOpenSessionsForChannel(db, 'ch-1', 'stream-new', '2026-06-03T00:00:00.000Z');

		expect(prepare.mock.calls[0][0]).toContain('platform_stream_id != ?');
		expect(batch).toHaveBeenCalledTimes(1);
	});

	it('batchCloseStaleOpenSessionsForChannels chunks stale closes at 50', async () => {
		const batch = vi.fn().mockResolvedValue([]);
		const prepare = vi.fn((sql: string) => ({
			bind: vi.fn().mockReturnThis(),
			sql
		}));
		const db = { prepare, batch } as unknown as D1Database;

		const closes = Array.from({ length: 75 }, (_, i) => ({
			channelId: `ch-${i}`,
			platformStreamId: `stream-${i}`
		}));
		await batchCloseStaleOpenSessionsForChannels(db, closes, '2026-06-03T00:00:00.000Z');

		expect(batch).toHaveBeenCalledTimes(2);
		expect(batch.mock.calls[0][0]).toHaveLength(50);
		expect(batch.mock.calls[1][0]).toHaveLength(25);
	});
});
