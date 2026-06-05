import {
	buildRankingsChannelsResponse,
	channelRankingsToCsv,
	csvAttachmentHeaders,
	csvDownloadFilename,
	parseRankingsChannelsQuery,
	parseResponseFormat
} from '@omnicharts/rollup';
import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { getD1 } from '$lib/server/d1';
import { webRankingEligibility } from '$lib/server/ranking-env';
import type { RequestHandler } from './$types';

type RankingsQueryError =
	| 'invalid_period'
	| 'invalid_limit'
	| 'invalid_platform'
	| 'invalid_format'
	| 'invalid_language';

function rankingsQueryErrorResponse(error: RankingsQueryError): Response {
	const messages = {
		invalid_period: 'period must be one of 24h, 7d, 30d, 90d',
		invalid_limit: 'limit must be a positive integer',
		invalid_platform: 'platform must be twitch, kick, or youtube',
		invalid_format: 'format must be json or csv',
		invalid_language: 'language must be a valid BCP 47 stream tag (e.g. en, es, zh-tw)'
	} as const;
	return Response.json(
		{ error: { code: error, message: messages[error] } },
		{ status: 400, headers: { 'cache-control': 'no-store' } }
	);
}

/** Rollup rankings — D1 on Pages; ingest proxy fallback (openapi GET /v1/rankings/channels). */
export const GET: RequestHandler = async ({ url, fetch, platform }) => {
	const db = getD1(platform);
	const formatParsed = parseResponseFormat(url);
	if (!formatParsed.ok) {
		return rankingsQueryErrorResponse(formatParsed.error);
	}
	const parsed = parseRankingsChannelsQuery(url);

	if (
		parsed.ok &&
		db &&
		(parsed.platform === 'twitch' || parsed.platform === 'kick' || parsed.platform === 'youtube')
	) {
		const eligibility = webRankingEligibility(platform?.env, parsed.platform);
		const body = await buildRankingsChannelsResponse(db, {
			platform: parsed.platform,
			period: parsed.period,
			limit: parsed.limit,
			language: parsed.language,
			minAirtimeMinutes: eligibility.minAirtimeMinutes,
			minAverageViewers: eligibility.minAverageViewers
		});
		if (formatParsed.format === 'csv') {
			const csv = channelRankingsToCsv(body);
			return new Response(csv, {
				headers: {
					...csvAttachmentHeaders(
						csvDownloadFilename([parsed.platform, 'channels', parsed.period])
					),
					'cache-control': ROLLUP_CACHE_CONTROL
				}
			});
		}
		return Response.json(body, {
			headers: { 'cache-control': ROLLUP_CACHE_CONTROL }
		});
	}

	if (!parsed.ok) {
		return rankingsQueryErrorResponse(parsed.error);
	}

	const target = new URL(`${getIngestBaseUrl()}/v1/rankings/channels`);
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
