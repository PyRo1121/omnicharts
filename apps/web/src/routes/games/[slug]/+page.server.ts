import { error } from '@sveltejs/kit';
import { applyRollupPageCache } from '$lib/server/cache';
import { loadGameDetail, parseGamePeriod } from '$lib/server/game';
import { serverLoadContext } from '$lib/server/load-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, url, setHeaders, platform: cfPlatform }) => {
	applyRollupPageCache(setHeaders);

	const ctx = serverLoadContext(fetch, cfPlatform);
	const platformId = url.searchParams.get('platform') ?? 'twitch';
	const { period, periodNote } = parseGamePeriod(url.searchParams.get('period'));
	const game = await loadGameDetail(ctx, params.slug, platformId, period);

	if (game.source === 'not_found') {
		error(404, `Game not found on ${platformId}`);
	}

	return { game, periodNote };
};
