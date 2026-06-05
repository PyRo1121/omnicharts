import {
	buildRankingsChannelsResponse,
	channelRankingsToCsv,
	csvAttachmentHeaders,
	csvDownloadFilename,
	parseRankingsChannelsQuery,
	parseResponseFormat,
	rankingsChannelsQueryErrorResponse,
} from '@omnicharts/rollup';
import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { proxyIngestResponse } from '$lib/server/proxy-ingest';
import { getD1 } from '$lib/server/d1';
import { cfRankingEnv } from '$lib/server/load-context';
import { webRankingEligibility } from '$lib/server/ranking-env';
import type { RequestHandler } from './$types';

/** Rollup rankings — D1 on Pages; ingest proxy fallback (openapi GET /v1/rankings/channels). */
export const GET: RequestHandler = async ({ url, fetch, platform }) => {
	const db = getD1(platform);
	const formatParsed = parseResponseFormat(url);
	if (!formatParsed.ok) {
		return rankingsChannelsQueryErrorResponse(formatParsed.error, { cacheControl: 'no-store' });
	}
	const parsed = parseRankingsChannelsQuery(url);

	if (parsed.ok && db && (parsed.platform === 'twitch' || parsed.platform === 'kick' || parsed.platform === 'youtube')) {
		const eligibility = webRankingEligibility(cfRankingEnv(platform), parsed.platform);
		const body = await buildRankingsChannelsResponse(db, {
			platform: parsed.platform,
			period: parsed.period,
			limit: parsed.limit,
			language: parsed.language,
			minAirtimeMinutes: eligibility.minAirtimeMinutes,
			minAverageViewers: eligibility.minAverageViewers,
		});
		if (formatParsed.format === 'csv') {
			const csv = channelRankingsToCsv(body);
			return new Response(csv, {
				headers: {
					...csvAttachmentHeaders(csvDownloadFilename([parsed.platform, 'channels', parsed.period])),
					'cache-control': ROLLUP_CACHE_CONTROL,
				},
			});
		}
		return Response.json(body, {
			headers: { 'cache-control': ROLLUP_CACHE_CONTROL },
		});
	}

	if (!parsed.ok) {
		return rankingsChannelsQueryErrorResponse(parsed.error, { cacheControl: 'no-store' });
	}

	const target = new URL(`${getIngestBaseUrl()}/v1/rankings/channels`);
	target.search = url.searchParams.toString();

	const res = await fetch(target.toString(), {
		headers: { accept: 'application/json' },
	});

	return proxyIngestResponse(res);
};
