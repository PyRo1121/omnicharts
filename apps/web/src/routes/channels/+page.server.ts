import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadChannelRankings } from '$lib/server/rankings';
import { resolvePeriodContext } from '$lib/server/period-context';
import { languageFilterNote, parseUiLanguage, parseUiPlatform, type PlatformId } from '$lib/ui/platform.svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const { period, periodNote } = await resolvePeriodContext(
		url.searchParams.get('period'),
		ctx.db
	);
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const language = parseUiLanguage(url.searchParams.get('language'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	const rankingsPlatform: PlatformId = platform === 'all' ? 'twitch' : platform;
	const rankings = await loadChannelRankings(
		ctx,
		rankingsPlatform,
		period,
		20,
		mockEnabled,
		language
	);
	return {
		...rankings,
		period,
		periodNote,
		platform,
		language,
		languageNote: languageFilterNote(rankingsPlatform, language),
		platformUnsupported: false
	};
};
