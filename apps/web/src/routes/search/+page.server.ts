import { applySearchPageCache } from '$lib/server/cache';
import { enrichSearchResultsWithRollups, searchChannels } from '$lib/server/search';
import { serverLoadContext } from '$lib/server/load-context';
import { loadChannelRankings } from '$lib/server/rankings';
import { trendingFromRankings } from '$lib/server/trending';
import { parseUiPlatform, searchPlatformId } from '$lib/mock/home';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch, setHeaders, platform: cfPlatform }) => {
	applySearchPageCache(setHeaders);
	const q = url.searchParams.get('q') ?? '';
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const searchPlatform = searchPlatformId(platform);
	const trendingPlatform =
		platform === 'kick' || platform === 'youtube' ? platform : searchPlatform;
	const ctx = serverLoadContext(fetch, cfPlatform);
	const [{ results: rawResults, error }, rankings] = await Promise.all([
		searchChannels(fetch, { q, platform: searchPlatform, limit: 25 }),
		loadChannelRankings(ctx, trendingPlatform, '7d', 5)
	]);

	const results =
		rawResults.length > 0 ? await enrichSearchResultsWithRollups(ctx, rawResults) : rawResults;

	return {
		q,
		platform,
		results,
		error,
		trending: trendingFromRankings(rankings.rows, { platform: trendingPlatform })
	};
};
