import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadGameRankings } from '$lib/server/game-rankings';
import { resolvePeriodContext } from '$lib/server/period-context';
import { parseUiPlatform, type PlatformId } from '$lib/ui/platform.svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const { period, periodNote } = await resolvePeriodContext(
		url.searchParams.get('period'),
		ctx.db
	);
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	const rankingsPlatform: Exclude<PlatformId, 'all'> =
		platform === 'all' ? 'twitch' : platform;
	const rankings = await loadGameRankings(ctx, rankingsPlatform, period, 20, mockEnabled);
	return {
		...rankings,
		period,
		periodNote,
		platform,
		platformUnsupported: false
	};
};
