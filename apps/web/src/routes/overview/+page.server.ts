import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadKickOverview, loadOverview, loadYoutubeOverview, type OverviewLoad } from '$lib/server/overview';
import { parseUiPlatform, type UiPlatformFilter } from '$lib/ui/platform.svelte';
import type { PageServerLoad } from './$types';

type OverviewPageData = OverviewLoad & { platform: UiPlatformFilter };

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);
	const ctx = serverLoadContext(fetch, cfPlatform);
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	if (platform === 'kick') {
		const overview = await loadKickOverview(ctx, mockEnabled);
		return {
			...overview,
			platform: 'kick',
		} satisfies OverviewPageData;
	}

	if (platform === 'youtube') {
		const overview = await loadYoutubeOverview(ctx, mockEnabled);
		return {
			...overview,
			platform: 'youtube',
		} satisfies OverviewPageData;
	}

	const overview = await loadOverview(ctx, mockEnabled);
	return {
		...overview,
		platform: platform === 'all' ? 'all' : 'twitch',
	} satisfies OverviewPageData;
};
