import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as kickDb from '../src/db/kick-live-batch';
import { KickPublicApiClient } from '../src/kick/api';
import { kickDiscoveryNeedsApiReason, runKickDiscovery } from '../src/kick/discover';

describe('kick discover', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('kickDiscoveryNeedsApiReason when credentials missing', () => {
		expect(kickDiscoveryNeedsApiReason({} as Env)).toMatch(/not configured/);
	});

	it('runKickDiscovery returns zeros when NEEDS_API', async () => {
		const result = await runKickDiscovery({} as Env);
		expect(result.categoriesScanned).toBe(0);
		expect(result.streamsSeen).toBe(0);
	});

	it('runKickDiscovery scans categories and upserts channels', async () => {
		vi.spyOn(KickPublicApiClient.prototype, 'getCategoriesV2').mockResolvedValue({
			data: [
				{ id: 1, name: 'Slots' },
				{ id: 2, name: 'IRL' }
			],
			pagination: { next_cursor: '' }
		});
		vi.spyOn(KickPublicApiClient.prototype, 'getLivestreamsByCategoryId').mockImplementation(
			async (categoryId: number) => [
				{
					broadcaster_user_id: categoryId * 10,
					channel_id: categoryId * 100,
					slug: `user-${categoryId}`,
					stream_title: 'Live',
					started_at: '2026-06-01T00:00:00Z',
					viewer_count: 25,
					category: { id: categoryId, name: 'Game' }
				}
			]
		);
		const gameSpy = vi.spyOn(kickDb, 'batchUpsertKickGameCategories').mockResolvedValue(new Map());
		const channelSpy = vi
			.spyOn(kickDb, 'batchUpsertKickChannelsFromLivestreams')
			.mockResolvedValue(new Map());

		const result = await runKickDiscovery(
			{
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				KICK_MIN_VIEWERS: '2',
				DB: {} as D1Database
			} as Env,
			{ quick: true }
		);

		expect(result.categoriesScanned).toBe(2);
		expect(result.categoryListPagesFetched).toBe(1);
		expect(result.streamsSeen).toBe(2);
		expect(result.channelsUpserted).toBe(2);
		expect(gameSpy).toHaveBeenCalledTimes(2);
		expect(channelSpy).toHaveBeenCalledWith(
			expect.anything(),
			expect.any(Array),
			expect.objectContaining({ directoryListing: true, promoteToTracked: true }),
			expect.objectContaining({ scope: 'kick:discover:channels' })
		);
	});
});
