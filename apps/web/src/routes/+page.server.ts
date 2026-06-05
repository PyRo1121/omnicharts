import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadKickOverview, loadOverview } from '$lib/server/overview';
import { trendingFromRankings } from '$lib/server/trending';
import { parseUiPeriod, parseUiPlatform, type PlatformId } from '$lib/mock/home';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);

	const { period, periodNote } = parseUiPeriod(url.searchParams.get('period'));
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	const overviewOpts = { period, channelLimit: 5, gameLimit: 5 };
	const overview =
		platform === 'kick'
			? await loadKickOverview(ctx, mockEnabled, overviewOpts)
			: await loadOverview(ctx, mockEnabled, overviewOpts);

	const emptyChannelRankings = {
		source: 'live' as const,
		period,
		updatedAt: null,
		rows: []
	};
	const emptyGameRankings = {
		source: 'live' as const,
		period,
		updatedAt: null,
		rows: []
	};

	if (platform === 'youtube') {
		return {
			period,
			periodNote,
			platform,
			overview,
			channelRankings: emptyChannelRankings,
			gameRankings: emptyGameRankings,
			platformUnsupported: true,
			trending: trendingFromRankings([], { platform: 'youtube' })
		};
	}

	if (platform === 'kick') {
		const channelRankings = overview.channelRankings ?? emptyChannelRankings;
		const gameRankings = overview.gameRankings ?? emptyGameRankings;
		return {
			period,
			periodNote,
			platform,
			overview,
			channelRankings,
			gameRankings,
			platformUnsupported: false,
			trending: trendingFromRankings(channelRankings.rows)
		};
	}

	const channelRankings = overview.channelRankings ?? emptyChannelRankings;

	return {
		period,
		periodNote,
		platform,
		overview,
		channelRankings,
		gameRankings: overview.gameRankings ?? emptyGameRankings,
		platformUnsupported: false,
		trending: trendingFromRankings(channelRankings.rows)
	};
};
