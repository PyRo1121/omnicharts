import { buildGameDetailResponse, parseGameDetailQuery } from '@omnicharts/rollup';
import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { getD1 } from '$lib/server/d1';
import { webRankingEligibility } from '$lib/server/ranking-env';
import type { RequestHandler } from './$types';

/** Game rollup detail — D1 on Pages; ingest proxy fallback (openapi GET /v1/games/{slug}). */
export const GET: RequestHandler = async ({ params, url, fetch, platform }) => {
	const db = getD1(platform);
	const detailUrl = new URL(url);
	detailUrl.pathname = `/v1/games/${params.slug}`;
	const query = parseGameDetailQuery(detailUrl);

	if (db && query.platform === 'twitch') {
		const eligibility = webRankingEligibility(platform?.env);
		const body = await buildGameDetailResponse(
			db,
			{
				platform: query.platform,
				slug: query.slug,
				period: query.period
			},
			{ minAirtimeMinutes: eligibility.minAirtimeMinutes }
		);
		if (!body) {
			return Response.json(
				{ error: { code: 'not_found', message: 'Game not found' } },
				{
					status: 404,
					headers: { 'cache-control': ROLLUP_CACHE_CONTROL }
				}
			);
		}
		return Response.json(body, {
			headers: { 'cache-control': ROLLUP_CACHE_CONTROL }
		});
	}

	const target = new URL(`${getIngestBaseUrl()}/v1/games/${encodeURIComponent(params.slug)}`);
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
