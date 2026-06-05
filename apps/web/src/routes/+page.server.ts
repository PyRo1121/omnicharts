import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadKickOverview, loadOverview, loadYoutubeOverview } from '$lib/server/overview';
import { trendingFromRankings } from '$lib/server/trending';
import { resolvePeriodContext } from '$lib/server/period-context';
import { parseUiPlatform } from '$lib/ui/platform.svelte';
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

	const overviewOpts = { period, channelLimit: 5, gameLimit: 5 };
	const overview =
		platform === 'kick'
			? await loadKickOverview(ctx, mockEnabled, overviewOpts)
			: platform === 'youtube'
				? await loadYoutubeOverview(ctx, mockEnabled, overviewOpts)
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

	if (platform === 'kick' || platform === 'youtube') {
		const channelRankings = overview.channelRankings ?? emptyChannelRankings;
		const gameRankings = overview.gameRankings ?? emptyGameRankings;
		return {
			period,
			periodNote,
			platform,
			overview,
			channelRankings,
			gameRankings,
			trending: trendingFromRankings(channelRankings.rows, { platform, mockEnabled })
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
		trending: trendingFromRankings(channelRankings.rows, { mockEnabled })
	};
};
