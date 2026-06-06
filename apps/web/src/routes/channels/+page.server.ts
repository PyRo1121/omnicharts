import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadChannelRankings } from '$lib/server/rankings';
import { resolvePeriodContext } from '$lib/server/period-context';
import type { PlatformId } from '@omnicharts/domain';
import { parseOptionalLanguageParam } from '@omnicharts/domain';
import { languageFilterNote, parseUiPlatform, searchPlatformId } from '$lib/ui/platform.svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const { period, periodNote } = await resolvePeriodContext(url.searchParams.get('period'), ctx.db);
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const languageRaw = url.searchParams.get('language');
	const languageParsed = parseOptionalLanguageParam(languageRaw);
	const language = languageParsed.ok ? languageParsed.language : null;
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	const rankingsPlatform: PlatformId = searchPlatformId(platform);
	const rankings = await loadChannelRankings(ctx, rankingsPlatform, period, 20, mockEnabled, language);
	let languageNote = languageFilterNote(rankingsPlatform, language);
	if (languageRaw?.trim() && !languageParsed.ok) {
		languageNote = 'Unknown language filter — showing all languages.';
	}
	return {
		...rankings,
		period,
		periodNote,
		platform,
		language,
		languageNote,
	};
};
