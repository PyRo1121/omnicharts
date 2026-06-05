import { describe, it, expect, vi } from 'vitest';
import { PLATFORM_KICK } from '@omnicharts/domain';
import { listKickChannelIdsToPoll } from '../src/db/kick';

describe('listKickChannelIdsToPoll', () => {
	it('queries tracked kick channels ordered by last_seen_at', async () => {
		const all = vi.fn().mockResolvedValue({
			results: [{ platform_channel_id: '42' }, { platform_channel_id: '7' }]
		});
		const bind = vi.fn().mockReturnValue({ all });
		const prepare = vi.fn((sql: string) => {
			expect(sql).toContain("platform_id = ?");
			expect(sql).toContain("ingest_state = 'tracked'");
			return { bind };
		});
		const db = { prepare } as unknown as D1Database;

		const ids = await listKickChannelIdsToPoll(db, 100);
		expect(ids).toEqual(['42', '7']);
		expect(bind).toHaveBeenCalledWith(PLATFORM_KICK, 100);
	});
});
