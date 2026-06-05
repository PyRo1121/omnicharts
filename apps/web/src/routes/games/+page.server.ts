import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadTwitchGameRankings } from '$lib/server/game-rankings';
import { parseUiPeriod } from '$lib/mock/home';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const { period, periodNote } = parseUiPeriod(url.searchParams.get('period'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));
	const rankings = await loadTwitchGameRankings(ctx, period, 20, mockEnabled);
	return { ...rankings, period, periodNote };
};
