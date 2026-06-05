import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadKickOverview, loadOverview, loadYoutubeOverview } from '$lib/server/overview';
import { parseUiPlatform, type PlatformId } from '$lib/mock/home';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);
	const ctx = serverLoadContext(fetch, cfPlatform);
	const platform = parseUiPlatform(url.searchParams.get('platform'));
	const mockEnabled = isDevMockEnabled(url.searchParams.get('demo'));

	if (platform === 'kick') {
		const overview = await loadKickOverview(ctx, mockEnabled);
		return {
			...overview,
			platform: 'kick' as PlatformId,
			platformUnsupported: false
		};
	}

	if (platform === 'youtube') {
		const overview = await loadYoutubeOverview(ctx, mockEnabled);
		return {
			...overview,
			platform: 'youtube' as PlatformId,
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
