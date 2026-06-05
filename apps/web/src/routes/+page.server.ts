import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadOverview } from '$lib/server/overview';
import { trendingFromRankings } from '$lib/server/trending';
import { parseUiPeriod, platforms, type PlatformId } from '$lib/mock/home';
import type { PageServerLoad } from './$types';

function parsePlatform(raw: string | null): PlatformId {
	if (raw && platforms.some((p) => p.id === raw)) return raw as PlatformId;
	return 'twitch';
}

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);

	const { period, periodNote } = parseUiPeriod(url.searchParams.get('period'));
	const platform = parsePlatform(url.searchParams.get('platform'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	const overview = await loadOverview(ctx, mockEnabled, {
		period,
		channelLimit: 5,
		gameLimit: 5
	});

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

	if (platform !== 'twitch' && platform !== 'all') {
		return {
			period,
			periodNote,
			platform,
			overview,
			channelRankings: emptyChannelRankings,
			gameRankings: emptyGameRankings,
			platformUnsupported: true,
			trending: trendingFromRankings([])
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
