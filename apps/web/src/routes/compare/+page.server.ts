import { applyRollupPageCache } from '$lib/server/cache';
import { loadChannelCompare, parseCompareSlugs } from '$lib/server/compare';
import { resolvePeriodContext } from '$lib/server/period-context';
import { parseComparePagePeriod } from '$lib/compare/url';
import { parseUiPlatform, searchPlatformId } from '$lib/ui/platform.svelte';
import { serverLoadContext } from '$lib/server/load-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const platformId = searchPlatformId(parseUiPlatform(url.searchParams.get('platform')));
	const period = parseComparePagePeriod(url.searchParams.get('period'));
	const { a, b } = parseCompareSlugs(
		url.searchParams.get('a'),
		url.searchParams.get('b')
	);

	const { periodNote } = await resolvePeriodContext(period, ctx.db);
	const compare = await loadChannelCompare(ctx, {
		a,
		b,
		platform: parseUiPlatform(url.searchParams.get('platform')),
		period
	});

	return {
		...compare,
		platform: platformId,
		periodNote
	};
};
