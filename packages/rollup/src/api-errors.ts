/** OpenAPI-shaped public API error envelopes — SSOT for ingest + Pages BFF. */

export type ApiErrorBody<E extends string> = {
	error: { code: E; message: string };
};

const RANKINGS_CHANNELS_MESSAGES = {
	invalid_period: 'period must be one of 24h, 7d, 30d, 90d',
	invalid_limit: 'limit must be a positive integer',
	invalid_platform: 'platform must be twitch, kick, or youtube',
	invalid_format: 'format must be json or csv',
	invalid_language: 'language must be a valid BCP 47 stream tag (e.g. en, es, zh-tw)',
} as const;

export type RankingsChannelsHttpQueryError = keyof typeof RANKINGS_CHANNELS_MESSAGES;

const RANKINGS_GAMES_MESSAGES = {
	invalid_period: 'period must be one of 24h, 7d, 30d, 90d',
	invalid_limit: 'limit must be a positive integer',
	invalid_platform: 'platform must be twitch, kick, or youtube',
	invalid_format: 'format must be json or csv',
} as const;

export type RankingsGamesHttpQueryError = keyof typeof RANKINGS_GAMES_MESSAGES;

const SEARCH_MESSAGES = {
	invalid_query: 'q must be between 2 and 100 characters',
	invalid_limit: 'limit must be a positive integer',
	invalid_platform: 'platform must be twitch, kick, or youtube',
	invalid_language: 'language must be a valid BCP 47 stream tag (e.g. en, es, zh-tw)',
} as const;

export type SearchHttpQueryError = keyof typeof SEARCH_MESSAGES;

const COMPARE_MESSAGES = {
	invalid_platform: 'platform must be twitch, kick, or youtube',
	invalid_period: 'period must be one of 7d, 30d, 90d',
	missing_slugs: 'query params a and b (channel slugs) are required',
} as const;

export type CompareHttpQueryError = keyof typeof COMPARE_MESSAGES;

const CHANNEL_DETAIL_MESSAGES = {
	invalid_platform: 'platform must be twitch, kick, or youtube',
	invalid_period: 'period must be one of 24h, 7d, 30d, 90d',
	invalid_format: 'format must be json or csv',
} as const;

export type ChannelDetailHttpQueryError = keyof typeof CHANNEL_DETAIL_MESSAGES;

type ErrorResponseOpts = {
	status?: number;
	cacheControl?: string;
};

function jsonApiErrorResponse(code: string, message: string, opts?: ErrorResponseOpts): Response {
	const headers: Record<string, string> = {};
	if (opts?.cacheControl) headers['cache-control'] = opts.cacheControl;
	return Response.json({ error: { code, message } } satisfies ApiErrorBody<string>, {
		status: opts?.status ?? 400,
		headers: Object.keys(headers).length > 0 ? headers : undefined,
	});
}

export function rankingsChannelsQueryErrorResponse(error: RankingsChannelsHttpQueryError, opts?: ErrorResponseOpts): Response {
	return jsonApiErrorResponse(error, RANKINGS_CHANNELS_MESSAGES[error], opts);
}

export function rankingsGamesQueryErrorResponse(error: RankingsGamesHttpQueryError, opts?: ErrorResponseOpts): Response {
	return jsonApiErrorResponse(error, RANKINGS_GAMES_MESSAGES[error], opts);
}

export function searchQueryErrorResponse(error: SearchHttpQueryError, opts?: ErrorResponseOpts): Response {
	return jsonApiErrorResponse(error, SEARCH_MESSAGES[error], opts);
}

export function compareQueryErrorResponse(error: CompareHttpQueryError, opts?: ErrorResponseOpts): Response {
	return jsonApiErrorResponse(error, COMPARE_MESSAGES[error], opts);
}

export function channelDetailQueryErrorResponse(error: ChannelDetailHttpQueryError, opts?: ErrorResponseOpts): Response {
	return jsonApiErrorResponse(error, CHANNEL_DETAIL_MESSAGES[error], opts);
}
