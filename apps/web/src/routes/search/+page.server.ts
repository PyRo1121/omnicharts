import { applySearchPageCache } from '$lib/server/cache';
import { enrichSearchResultsWithRollups, searchChannels } from '$lib/server/search';
import { serverLoadContext } from '$lib/server/load-context';
import { loadChannelRankings } from '$lib/server/rankings';
import { trendingFromRankings } from '$lib/server/trending';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { parseOptionalLanguageParam } from '@omnicharts/domain';
import { parseUiPlatform, searchPlatformId, languageFilterNote } from '$lib/ui/platform.svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch, setHeaders, platform: cfPlatform }) => {
	applySearchPageCache(setHeaders);
	const q = url.searchParams.get('q') ?? '';
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const languageRaw = url.searchParams.get('language');
	const languageParsed = parseOptionalLanguageParam(languageRaw);
	const language = languageParsed.ok ? languageParsed.language : null;
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));
	const searchPlatform = searchPlatformId(platform);
	const trendingPlatform = platform === 'kick' || platform === 'youtube' ? platform : searchPlatform;
	const ctx = serverLoadContext(fetch, cfPlatform);
	const [{ results: rawResults, error }, rankings] = await Promise.all([
		searchChannels(fetch, { q, platform: searchPlatform, limit: 25, language }),
		loadChannelRankings(ctx, trendingPlatform, '7d', 5),
	]);

	const results = rawResults.length > 0 ? await enrichSearchResultsWithRollups(ctx, rawResults) : rawResults;

	let languageNote = languageFilterNote(searchPlatform, language);
	if (languageRaw?.trim() && !languageParsed.ok) {
		languageNote = 'Unknown language filter — showing all languages.';
	}

	return {
		q,
		platform,
		language,
		languageNote,
		results,
		error,
		trending: trendingFromRankings(rankings.rows, { platform: trendingPlatform, mockEnabled }),
	};
};
