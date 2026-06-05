import { error, redirect } from '@sveltejs/kit';
import { applyRollupPageCache } from '$lib/server/cache';
import {
	findChannelOnOtherPlatforms,
	loadChannelDetail,
	parseChannelPeriod,
	resolveChannelSlugFromHistory
} from '$lib/server/channel';
import { parseUiPlatform, searchPlatformId } from '$lib/ui/platform.svelte';
import { serverLoadContext } from '$lib/server/load-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const platformId = searchPlatformId(parseUiPlatform(url.searchParams.get('platform')));
	const { period, periodNote } = parseChannelPeriod(url.searchParams.get('period'));
	let channel = await loadChannelDetail(ctx, params.slug, platformId, period);

	if (channel.source === 'not_found') {
		const canonical = await resolveChannelSlugFromHistory(ctx, params.slug, platformId);
		if (canonical) {
			const q = new URLSearchParams({ platform: platformId, period });
			throw redirect(301, `/channels/${encodeURIComponent(canonical)}?${q}`);
		}
		const suggestions = await findChannelOnOtherPlatforms(ctx, params.slug, platformId);
		error(404, {
			message: `Channel not found on ${platformId}`,
			suggestions
		});
	}

	return { channel, periodNote };
};
