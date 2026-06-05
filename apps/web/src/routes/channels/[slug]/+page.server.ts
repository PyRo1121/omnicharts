import { error, redirect } from '@sveltejs/kit';
import { applyRollupPageCache } from '$lib/server/cache';
import {
	loadChannelDetail,
	parseChannelPeriod,
	resolveChannelSlugFromHistory
} from '$lib/server/channel';
import { serverLoadContext } from '$lib/server/load-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const platformId = url.searchParams.get('platform') ?? 'twitch';
	const { period, periodNote } = parseChannelPeriod(url.searchParams.get('period'));
	let channel = await loadChannelDetail(ctx, params.slug, platformId, period);

	if (channel.source === 'not_found') {
		const canonical = await resolveChannelSlugFromHistory(ctx, params.slug, platformId);
		if (canonical) {
			const q = new URLSearchParams({ platform: platformId, period });
			throw redirect(301, `/channels/${encodeURIComponent(canonical)}?${q}`);
		}
		error(404, `Channel not found on ${platformId}`);
	}

	return { channel, periodNote };
};
