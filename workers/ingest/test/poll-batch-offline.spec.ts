import { describe, it, expect, vi } from 'vitest';
import { mockIngestD1, testEnv } from './helpers';
import { runTwitchPollBatch } from '../src/twitch/poll';

vi.mock('../src/twitch/helix', () => ({
	TwitchHelixClient: class {
		async getStreamsByUserIds() {
			return [];
		}
	},
}));

describe('runTwitchPollBatch offline updates', () => {
	it('batches offline last_seen UPDATEs and closes open sessions via DB.batch', async () => {
		const batch = vi.fn().mockResolvedValue([]);
		const run = vi.fn().mockResolvedValue({ success: true });
		const prepareCalls: string[] = [];

		const userIds = Array.from({ length: 75 }, (_, i) => String(i));
		const env = testEnv({
			DB: mockIngestD1((sql) => {
				prepareCalls.push(sql);
				return { bind: vi.fn().mockReturnValue({ run }) };
			}, batch),
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'secret',
		});

		await runTwitchPollBatch(env, userIds);

		expect(batch).toHaveBeenCalledTimes(3);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(50);
		expect(batch.mock.calls[1]?.[0]).toHaveLength(25);
		expect(batch.mock.calls[2]?.[0]).toHaveLength(2);
		expect(prepareCalls.some((sql) => sql.includes('UPDATE stream_sessions SET ended_at'))).toBe(true);
	});
});
