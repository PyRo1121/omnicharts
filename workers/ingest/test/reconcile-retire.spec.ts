import { describe, it, expect, vi, beforeEach } from 'vitest';
import { noopBatchD1, testEnv } from './helpers';
import * as twitchDb from '../src/db/twitch';
import { TwitchHelixClient } from '../src/twitch/helix';
import { runTwitchReconcileRecent } from '../src/twitch/reconcile';

vi.mock('../src/twitch/ingest-stream', () => ({
	ingestHelixStreamsBatch: vi.fn().mockResolvedValue([]),
}));

import { ingestHelixStreamsBatch } from '../src/twitch/ingest-stream';

describe('runTwitchReconcileRecent', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.mocked(ingestHelixStreamsBatch).mockResolvedValue([]);
	});

	it('does not call GET /users for offline channels (retire via enrich pass)', async () => {
		vi.spyOn(twitchDb, 'listRecentlyTrackedPlatformIds').mockResolvedValue(['live-id', 'gone-id']);

		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByUserIds').mockResolvedValue([
			{
				id: 's1',
				user_id: 'live-id',
				user_login: 'live',
				user_name: 'Live',
				game_id: '1',
				game_name: 'G',
				title: 'T',
				viewer_count: 100,
				started_at: '2026-06-01T00:00:00Z',
				type: 'live',
			},
		]);
		const getUsers = vi.spyOn(TwitchHelixClient.prototype, 'getUsersByIds');

		const stats = await runTwitchReconcileRecent(
			testEnv({
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'secret',
				DB: noopBatchD1(),
			}),
		);
		expect(stats.retired).toBe(0);
		expect(getUsers).not.toHaveBeenCalled();
	});
});
