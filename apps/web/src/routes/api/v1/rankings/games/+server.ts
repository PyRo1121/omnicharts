import {
	buildRankingsGamesResponse,
	csvAttachmentHeaders,
	csvDownloadFilename,
	gameRankingsToCsv,
	parseRankingsGamesQuery,
	parseResponseFormat,
	rankingsGamesQueryErrorResponse,
} from '@omnicharts/rollup';
import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { proxyIngestResponse } from '$lib/server/proxy-ingest';
import { getD1 } from '$lib/server/d1';
import { resolveWebRankingEnv } from '$lib/server/ranking-env';
import type { RequestHandler } from './$types';

/** Rollup rankings — D1 on Pages; ingest proxy fallback (GET /v1/rankings/games). */
export const GET: RequestHandler = async ({ url, fetch, platform }) => {
	const db = getD1(platform);
	const formatParsed = parseResponseFormat(url);
	if (!formatParsed.ok) {
		return rankingsGamesQueryErrorResponse(formatParsed.error, { cacheControl: 'no-store' });
	}
	const parsed = parseRankingsGamesQuery(url);

	if (parsed.ok && db && (parsed.platform === 'twitch' || parsed.platform === 'kick' || parsed.platform === 'youtube')) {
		const body = await buildRankingsGamesResponse(
			db,
			{
				platform: parsed.platform,
				period: parsed.period,
				limit: parsed.limit,
			},
			resolveWebRankingEnv(platform?.env),
		);
		if (formatParsed.format === 'csv') {
			const csv = gameRankingsToCsv(body);
			return new Response(csv, {
				headers: {
					...csvAttachmentHeaders(csvDownloadFilename([parsed.platform, 'games', parsed.period])),
					'cache-control': ROLLUP_CACHE_CONTROL,
				},
			});
		}
		return Response.json(body, {
			headers: { 'cache-control': ROLLUP_CACHE_CONTROL },
		});
	}

	if (parsed.ok === false) {
		return rankingsGamesQueryErrorResponse(parsed.error, { cacheControl: 'no-store' });
	}

	const target = new URL(`${getIngestBaseUrl()}/v1/rankings/games`);
	target.search = url.searchParams.toString();

	const res = await fetch(target.toString(), {
		headers: { accept: 'application/json' },
	});

	return proxyIngestResponse(res);
};
