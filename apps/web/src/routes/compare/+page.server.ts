import { applyRollupPageCache } from '$lib/server/cache';
import { loadChannelCompare, parseCompareSlugs } from '$lib/server/compare';
import { resolvePeriodContext } from '$lib/server/period-context';
import { isComparePeriod, parseComparePeriod } from '@omnicharts/domain';
import { parseUiPlatform, searchPlatformId } from '$lib/ui/platform.svelte';
import { serverLoadContext } from '$lib/server/load-context';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const platformId = searchPlatformId(parseUiPlatform(url.searchParams.get('platform')));
	const periodRaw = url.searchParams.get('period');
	if (periodRaw != null && periodRaw !== '' && !isComparePeriod(periodRaw)) {
		error(400, 'Invalid compare period. Use 7d, 30d, or 90d.');
	}
	const period = parseComparePeriod(periodRaw);
	const { a, b } = parseCompareSlugs(url.searchParams.get('a'), url.searchParams.get('b'));

	const { periodNote } = await resolvePeriodContext(period, ctx.db);
	const compare = await loadChannelCompare(ctx, {
		a,
		b,
		platform: platformId,
		period,
	});

	return {
		...compare,
		platform: platformId,
		periodNote,
	};
};
