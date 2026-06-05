import {
	buildRankingsGamesResponse,
	parseRankingsGamesQuery
} from '@omnicharts/rollup';
import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { getD1 } from '$lib/server/d1';
import { resolveWebRankingEnv } from '$lib/server/ranking-env';
import type { RequestHandler } from './$types';

/** Rollup rankings — D1 on Pages; ingest proxy fallback (GET /v1/rankings/games). */
export const GET: RequestHandler = async ({ url, fetch, platform }) => {
	const db = getD1(platform);
	const parsed = parseRankingsGamesQuery(url);

	if (parsed.ok && db && parsed.platform === 'twitch') {
		const body = await buildRankingsGamesResponse(
			db,
			{
				platform: parsed.platform,
				period: parsed.period,
				limit: parsed.limit
			},
			resolveWebRankingEnv(platform?.env)
		);
		return Response.json(body, {
			headers: { 'cache-control': ROLLUP_CACHE_CONTROL }
		});
	}

	if (parsed.ok === false) {
		return Response.json(
			{ error: parsed.error },
			{ status: 400, headers: { 'cache-control': 'no-store' } }
		);
	}

	const target = new URL(`${getIngestBaseUrl()}/v1/rankings/games`);
	target.search = url.searchParams.toString();

	const res = await fetch(target.toString(), {
		headers: { accept: 'application/json' }
	});

	return new Response(res.body, {
		status: res.status,
		headers: {
			'content-type': res.headers.get('content-type') ?? 'application/json',
			'cache-control': res.headers.get('cache-control') ?? ROLLUP_CACHE_CONTROL
		}
	});
};
