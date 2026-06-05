import { describe, it, expect, vi, beforeEach } from 'vitest';
import { noopBatchD1, testEnv } from './helpers';
import type { HelixStream } from '../src/twitch/helix';
import { ingestStreamPage } from '../src/twitch/stream-page';

const stream = (userId: string, viewers: number): HelixStream => ({
	id: `s-${userId}`,
	user_id: userId,
	user_login: userId,
	user_name: userId,
	game_id: '1',
	game_name: 'G',
	title: 'T',
	viewer_count: viewers,
	started_at: '2026-06-01T00:00:00Z',
	type: 'live',
});

vi.mock('../src/twitch/ingest-stream', () => ({
	ingestHelixStreamsBatch: vi.fn().mockResolvedValue([]),
	flushSampleArchivePage: vi.fn().mockResolvedValue(undefined),
}));

describe('ingestStreamPage', () => {
	const env = testEnv({ DB: noopBatchD1() });

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('dedupes user ids within a cycle', async () => {
		const seen = new Set<string>();
		const stats = {
			streamsSeen: 0,
			channelsIngested: 0,
			duplicatesSkipped: 0,
		};

		await ingestStreamPage(env, [stream('u1', 100), stream('u1', 90), stream('u2', 50)], 2, seen, stats);

		expect(stats.streamsSeen).toBe(2);
		expect(stats.duplicatesSkipped).toBe(1);
		expect(stats.channelsIngested).toBe(2);
		expect(seen.size).toBe(2);
	});

	it('tracks page max viewers', async () => {
		const stats = {
			streamsSeen: 0,
			channelsIngested: 0,
			duplicatesSkipped: 0,
		};
		const { pageMaxViewers } = await ingestStreamPage(env, [stream('a', 10), stream('b', 99)], 0, new Set(), stats);
		expect(pageMaxViewers).toBe(99);
	});
});
