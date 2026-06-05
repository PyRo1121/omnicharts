import {
	buildChannelDetailResponse,
	channelDetailQueryErrorResponse,
	channelDetailToCsv,
	csvAttachmentHeaders,
	csvDownloadFilename,
	parseChannelDetailQuery,
	parseResponseFormat
} from '@omnicharts/rollup';
import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { proxyIngestResponse } from '$lib/server/proxy-ingest';
import { getD1 } from '$lib/server/d1';
import type { RequestHandler } from './$types';

/** Channel rollup detail — D1 on Pages; ingest proxy fallback (openapi GET /v1/channels/{slug}). */
export const GET: RequestHandler = async ({ params, url, fetch, platform }) => {
	const db = getD1(platform);
	const detailUrl = new URL(url);
	detailUrl.pathname = `/v1/channels/${params.slug}`;
	const formatParsed = parseResponseFormat(url);
	if (!formatParsed.ok) {
		return channelDetailQueryErrorResponse(formatParsed.error);
	}
	const query = parseChannelDetailQuery(detailUrl);

	if (!query.ok) {
		return channelDetailQueryErrorResponse(query.error);
	}

	if (
		db &&
		(query.platform === 'twitch' || query.platform === 'kick' || query.platform === 'youtube')
	) {
		const body = await buildChannelDetailResponse(db, {
			platform: query.platform,
			slug: query.slug,
			period: query.period
		});
		if (!body) {
			return Response.json(
				{ error: { code: 'not_found', message: 'Channel not found' } },
				{
					status: 404,
					headers: { 'cache-control': ROLLUP_CACHE_CONTROL }
				}
			);
		}
		if (formatParsed.format === 'csv') {
			const csv = channelDetailToCsv(body);
			return new Response(csv, {
				headers: {
					...csvAttachmentHeaders(
						csvDownloadFilename([body.platform, body.slug, body.period])
					),
					'cache-control': ROLLUP_CACHE_CONTROL
				}
			});
		}
		return Response.json(body, {
			headers: { 'cache-control': ROLLUP_CACHE_CONTROL }
		});
	}

	const target = new URL(
		`${getIngestBaseUrl()}/v1/channels/${encodeURIComponent(params.slug)}`
	);
	target.search = url.searchParams.toString();

	const res = await fetch(target.toString(), {
		headers: { accept: 'application/json' }
	});

	return proxyIngestResponse(res);
};
