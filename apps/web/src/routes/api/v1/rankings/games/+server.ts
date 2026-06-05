import {
	buildRankingsGamesResponse,
	parseRankingsGamesQuery
} from '@omnicharts/rollup';
import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { getD1 } from '$lib/server/d1';
import { resolveWebRankingEnv } from '$lib/server/ranking-env';
import type { RequestHandler } from './$types';

function rankingsQueryErrorResponse(
	error: 'invalid_period' | 'invalid_limit' | 'invalid_platform'
): Response {
	const messages = {
		invalid_period: 'period must be one of 24h, 7d, 30d, 90d',
		invalid_limit: 'limit must be a positive integer',
		invalid_platform: 'platform must be twitch, kick, or youtube'
	} as const;
	return Response.json(
		{ error: { code: error, message: messages[error] } },
		{ status: 400, headers: { 'cache-control': 'no-store' } }
	);
}

/** Rollup rankings — D1 on Pages; ingest proxy fallback (GET /v1/rankings/games). */
export const GET: RequestHandler = async ({ url, fetch, platform }) => {
	const db = getD1(platform);
	const parsed = parseRankingsGamesQuery(url);

	if (
		parsed.ok &&
		db &&
		(parsed.platform === 'twitch' || parsed.platform === 'kick' || parsed.platform === 'youtube')
	) {
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
		return rankingsQueryErrorResponse(parsed.error);
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
