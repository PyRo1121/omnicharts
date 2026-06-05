import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadKickOverview, loadOverview } from '$lib/server/overview';
import { parseUiPlatform, type PlatformId } from '$lib/mock/home';
import type { PageServerLoad } from './$types';

const emptyOverview = {
	source: 'live' as const,
	ingestStatus: null,
	stats: [],
	channelsLive: null,
	topChannelName: null,
	topGameName: null
};

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);
	const ctx = serverLoadContext(fetch, cfPlatform);
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	if (platform === 'youtube') {
		return {
			platform,
			platformUnsupported: true,
			...emptyOverview
		};
	}

	if (platform === 'kick') {
		const overview = await loadKickOverview(ctx, mockEnabled);
		return {
			...overview,
			platform: 'kick' as PlatformId,
			platformUnsupported: false
		};
	}

	const overview = await loadOverview(ctx, mockEnabled);
	return {
		...overview,
		platform: platform === 'all' ? 'all' : ('twitch' as PlatformId),
		platformUnsupported: false
	};
};
