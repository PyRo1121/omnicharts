import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadOverview } from '$lib/server/overview';
import { parseUiPlatform, type PlatformId } from '$lib/mock/home';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);
	const ctx = serverLoadContext(fetch, cfPlatform);
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	if (platform !== 'twitch' && platform !== 'all') {
		return {
			platform,
			platformUnsupported: true,
			source: 'live' as const,
			ingestStatus: null,
			stats: [],
			channelsLive: null,
			topChannelName: null,
			topGameName: null
		};
	}

	const overview = await loadOverview(ctx, mockEnabled);
	return {
		...overview,
		platform: 'twitch' as PlatformId,
		platformUnsupported: false
	};
};
