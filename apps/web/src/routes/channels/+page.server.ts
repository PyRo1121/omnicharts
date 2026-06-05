import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadChannelRankings } from '$lib/server/rankings';
import { parseUiPeriod, parseUiPlatform, type PlatformId } from '$lib/mock/home';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const { period, periodNote } = parseUiPeriod(url.searchParams.get('period'));
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	if (platform === 'youtube') {
		return {
			source: 'live' as const,
			period,
			periodNote,
			platform,
			platformUnsupported: true,
			updatedAt: null,
			rows: []
		};
	}

	const rankingsPlatform: PlatformId = platform === 'all' ? 'twitch' : platform;
	const rankings = await loadChannelRankings(ctx, rankingsPlatform, period, 20, mockEnabled);
	return {
		...rankings,
		period,
		periodNote,
		platform: rankingsPlatform,
		platformUnsupported: false
	};
};
