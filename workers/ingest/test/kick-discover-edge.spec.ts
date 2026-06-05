import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as kickDb from '../src/db/kick-live-batch';
import { KickPublicApiClient } from '../src/kick/api';
import { runKickDiscovery } from '../src/kick/discover';

describe('kick discover edge cases', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('runKickDiscovery handles empty category list', async () => {
		vi.spyOn(KickPublicApiClient.prototype, 'getCategoriesV2').mockResolvedValue({
			data: [],
			pagination: {}
		});

		const result = await runKickDiscovery(
			{
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				DB: {} as D1Database
			} as Env,
			{ quick: true }
		);

		expect(result.categoriesScanned).toBe(0);
		expect(result.streamsSeen).toBe(0);
		expect(result.channelsUpserted).toBe(0);
	});

	it('runKickDiscovery skips categories with non-finite id', async () => {
		vi.spyOn(KickPublicApiClient.prototype, 'getCategoriesV2').mockResolvedValue({
			data: [
				{ id: Number.NaN, name: 'Bad' },
				{ id: 5, name: 'Good' }
			],
			pagination: {}
		});
		const liveSpy = vi
			.spyOn(KickPublicApiClient.prototype, 'getLivestreamsByCategoryId')
			.mockResolvedValue([]);
		vi.spyOn(kickDb, 'batchUpsertKickGameCategories').mockResolvedValue(new Map());
		vi.spyOn(kickDb, 'batchUpsertKickChannelsFromLivestreams').mockResolvedValue(new Map());

		const result = await runKickDiscovery(
			{
				KICK_CLIENT_ID: 'id',
				KICK_CLIENT_SECRET: 'secret',
				DB: {} as D1Database
			} as Env,
			{ quick: true }
		);

		expect(result.categoriesScanned).toBe(1);
		expect(liveSpy).toHaveBeenCalledTimes(1);
		expect(liveSpy).toHaveBeenCalledWith(5, expect.any(Object));
	});
});
