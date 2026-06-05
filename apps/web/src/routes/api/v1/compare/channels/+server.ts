import {
	buildCompareChannelsResponse,
	parseCompareChannelsQuery
} from '@omnicharts/rollup';
import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { getD1 } from '$lib/server/d1';
import type { RequestHandler } from './$types';

function compareQueryErrorResponse(
	error: 'invalid_platform' | 'invalid_period' | 'missing_slugs'
): Response {
	const messages = {
		invalid_platform: 'platform must be twitch, kick, or youtube',
		invalid_period: 'period must be one of 7d, 30d, 90d',
		missing_slugs: 'query params a and b (channel slugs) are required'
	} as const;
	return Response.json(
		{
			error: {
				code: error,
				message: messages[error]
			}
		},
		{ status: 400, headers: { 'cache-control': 'no-store' } }
	);
}

/** Side-by-side channel compare — rollup reads only (openapi GET /v1/compare/channels). */
export const GET: RequestHandler = async ({ url, fetch, platform }) => {
	const db = getD1(platform);
	const query = parseCompareChannelsQuery(url);

	if (!query.ok) {
		return compareQueryErrorResponse(query.error);
	}

	if (
		db &&
		(query.platform === 'twitch' || query.platform === 'kick' || query.platform === 'youtube')
	) {
		const body = await buildCompareChannelsResponse(db, {
			platform: query.platform,
			period: query.period,
			a: query.a,
			b: query.b
		});
		return Response.json(body, {
			headers: { 'cache-control': ROLLUP_CACHE_CONTROL }
		});
	}

	const [aRes, bRes] = await Promise.all([
		fetch(
			`${getIngestBaseUrl()}/v1/channels/${encodeURIComponent(query.a)}?platform=${encodeURIComponent(query.platform)}&period=${encodeURIComponent(query.period)}`,
			{ headers: { accept: 'application/json' } }
		),
		fetch(
			`${getIngestBaseUrl()}/v1/channels/${encodeURIComponent(query.b)}?platform=${encodeURIComponent(query.platform)}&period=${encodeURIComponent(query.period)}`,
			{ headers: { accept: 'application/json' } }
		)
	]);

	const [aBody, bBody] = await Promise.all([
		aRes.ok ? aRes.json() : Promise.resolve(null),
		bRes.ok ? bRes.json() : Promise.resolve(null)
	]);

	const body = {
		platform: query.platform,
		period: query.period,
		updated_at: new Date().toISOString(),
		a: {
			slug: query.a,
			found: aRes.ok,
			channel: aBody
		},
		b: {
			slug: query.b,
			found: bRes.ok,
			channel: bBody
		}
	};

	return Response.json(body, {
		headers: { 'cache-control': ROLLUP_CACHE_CONTROL }
	});
};
