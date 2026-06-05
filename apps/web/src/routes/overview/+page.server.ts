import { applyRollupPageCache } from '$lib/server/cache';
import { isDevMockEnabled } from '$lib/server/dev-mock';
import { serverLoadContext } from '$lib/server/load-context';
import { loadOverview } from '$lib/server/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);
	const ctx = serverLoadContext(fetch, cfPlatform);
	return loadOverview(ctx, isDevMockEnabled(url.searchParams.get('demo')));
};
