import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HelixStream } from '../src/twitch/helix';
import { ingestHelixStream } from '../src/twitch/ingest-stream';

const stream: HelixStream = {
	id: '1',
	user_id: '2',
	user_login: 'x',
	user_name: 'X',
	game_id: '509658',
	game_name: 'G',
	title: 'T',
	viewer_count: 100,
	started_at: '2026-06-01T00:00:00Z',
	type: 'live'
};

vi.mock('../src/db/twitch', () => ({
	batchUpsertGameCategories: vi.fn().mockResolvedValue(new Map([['509658', 'twitch-game-509658']])),
	batchUpsertChannelsFromStreams: vi
		.fn()
		.mockResolvedValue(new Map([['2', 'twitch-ch-2']])),
	batchRecordLiveSamples: vi.fn().mockResolvedValue([
		{
			stream_session_id: 'sess',
			sampled_at: '2026-06-01T00:00:00Z',
			viewer_count: 100,
			platform: 'twitch'
		}
	])
}));

import {
	batchRecordLiveSamples,
	batchUpsertChannelsFromStreams,
	batchUpsertGameCategories
} from '../src/db/twitch';

describe('ingestHelixStream ordering', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('batch upserts game, channel, then live sample', async () => {
		const env = { DB: {} } as Env;
		await ingestHelixStream(env, stream, 20);

		expect(batchUpsertGameCategories).toHaveBeenCalledBefore(
			batchUpsertChannelsFromStreams as never
		);
		expect(batchUpsertChannelsFromStreams).toHaveBeenCalledBefore(
			batchRecordLiveSamples as never
		);
		expect(batchRecordLiveSamples).toHaveBeenCalledWith(
			env.DB,
			[
				{
					channelId: 'twitch-ch-2',
					stream,
					gameCategoryId: 'twitch-game-509658'
				}
			],
			expect.objectContaining({ scope: 'ingest:samples' })
		);
	});
});
