/**
 * OmniCharts ingest Worker — cron enqueues; consumer polls platforms (Phase 1+).
 * @see docs/15-ingest-runbook.md
 */

import { parseQueueBody, type IngestQueueMessage } from './messages';
import { runTwitchDiscovery } from './twitch/discover';
import {
	enqueueTwitchPollShards,
	runTwitchCatalogPoll,
	runTwitchPollBatch
} from './twitch/poll';
import { runTwitchLiveSweep } from './twitch/sweep';
import { runTwitchCoverageCycle } from './twitch/coverage';
import { runTwitchGamePass } from './twitch/game-pass';
import { runTwitchSweepAndGamePass } from './twitch/sweep-game-pass';
import { runTwitchReconcileRecent } from './twitch/reconcile';
import { runTwitchPollPlatform } from './twitch/poll-platform';
import { runKickDiscovery } from './kick/discover';
import { runKickPollPlatform } from './kick/poll-platform';
import { runYoutubePollPlatform } from './youtube/poll-platform';
import { checkPublicRateLimit } from './http/rate-limit';
import { corsAllowOrigin } from './http/cors';
import {
	getCachedRankingsChannels,
	getCachedRankingsGames,
	rankingsChannelsCacheKey,
	rankingsGamesCacheKey,
	rankingsResponseHeaders,
	setCachedRankingsChannels,
	setCachedRankingsGames
} from './http/rankings-cache';
import { ENRICH_MAX_CHANNELS_PER_RUN } from './twitch/config';
import { runTwitchProfileEnrichment } from './twitch/enrich-profiles';
import { handleTwitchEventSubWebhook } from './twitch/eventsub/handler';
import { handleKickWebhook } from './kick/webhook/handler';
import { syncTwitchEventSubSubscriptions } from './twitch/eventsub/sync';
import { runDailyRollup } from './rollup/daily-job';
import {
	buildIngestHealth,
	buildPublicHealth,
	ingestHealthHttpStatus
} from './health/status';
import {
	buildRankingsChannelsResponse,
	parseRankingsChannelsQuery
} from './ranking/channels-api';
import {
	buildRankingsGamesResponse,
	parseRankingsGamesQuery
} from './ranking/games-api';
import {
	buildChannelDetailResponse,
	parseChannelDetailQuery,
	resolveChannelSlug
} from './ranking/channel-api';
import {
	buildGameDetailResponse,
	parseGameDetailQuery
} from './ranking/game-api';
import { parseSearchChannelsQuery, searchChannels } from './search/channels';
import { PLATFORM_TWITCH } from '@omnicharts/domain';
import { hasTwitchAppCredentials, twitchAppCredentialsErrorResponse } from './twitch/credentials';
import { isDevAdminRouteAllowed } from './dev/admin-guard';
import { clearDevSeedChannels } from './dev/clear-seed';
import { seedDevRankings } from './dev/seed-rankings';
import { recordDiscoverySeed, recordKickDiscoverySeed } from './discovery/seed';
import { rankingQueryOptionsFromEnv } from './ranking/rollup-queries';
import { isAdminPostPath, isAdminRankingsGetPath, requireAdminApiKey } from './admin/auth';
import { ingestNonFatalError, ingestWarn } from './log';
import { cronToMessages } from './cron-messages';
import { requireDb, requireIngestQueue } from './worker-bindings';
export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		const rateLimited = checkPublicRateLimit(request, env, url.pathname);
		if (rateLimited) return rateLimited;

		if (isAdminPostPath(url.pathname, request.method)) {
			const authFailure = requireAdminApiKey(request, env);
			if (authFailure) return authFailure;
		}

		if (url.pathname === '/health') {
			return healthResponse(request, env);
		}

		if (isAdminRankingsGetPath(url.pathname, request.method)) {
			return redirectAdminRankingsToV1(request);
		}

		if (url.pathname === '/admin/twitch/discover' && request.method === 'POST') {
			return adminTwitchDiscover(request, env);
		}

		if (url.pathname === '/admin/kick/discover' && request.method === 'POST') {
			return adminKickDiscover(request, env);
		}

		if (url.pathname === '/admin/twitch/poll' && request.method === 'POST') {
			return adminTwitchPoll(request, env);
		}

		if (url.pathname === '/admin/twitch/enrich-profiles' && request.method === 'POST') {
			return adminTwitchEnrichProfiles(env);
		}

		if (url.pathname === '/admin/twitch/poll-catalog' && request.method === 'POST') {
			return adminTwitchPollCatalog(env);
		}

		if (url.pathname === '/webhooks/twitch/eventsub' && request.method === 'POST') {
			return handleTwitchEventSubWebhook(request, env, ctx);
		}

		if (url.pathname === '/webhooks/kick/events' && request.method === 'POST') {
			return handleKickWebhook(request, env);
		}

		if (url.pathname === '/admin/twitch/eventsub/sync' && request.method === 'POST') {
			return adminTwitchEventSubSync(env);
		}

		if (url.pathname === '/admin/rollup/daily' && request.method === 'POST') {
			return adminRollupDaily(request, env);
		}

		if (url.pathname === '/v1/rankings/channels' && request.method === 'GET') {
			return publicRankingsChannels(request, env);
		}

		if (url.pathname === '/v1/rankings/games' && request.method === 'GET') {
			return publicRankingsGames(request, env);
		}

		if (url.pathname === '/v1/search/channels' && request.method === 'GET') {
			return publicSearchChannels(request, env);
		}

		if (url.pathname === '/v1/channels/resolve' && request.method === 'GET') {
			return publicChannelResolve(request, env);
		}

		const channelSlugMatch = url.pathname.match(/^\/v1\/channels\/([^/]+)$/);
		if (channelSlugMatch && request.method === 'GET') {
			return publicChannelDetail(request, env, decodeURIComponent(channelSlugMatch[1]));
		}

		const gameSlugMatch = url.pathname.match(/^\/v1\/games\/([^/]+)$/);
		if (gameSlugMatch && request.method === 'GET') {
			return publicGameDetail(request, env, decodeURIComponent(gameSlugMatch[1]));
		}

		if (url.pathname === '/admin/dev/seed-rankings' && request.method === 'POST') {
			return adminDevRoute(env, () => adminDevSeedRankings(env));
		}

		if (url.pathname === '/admin/dev/reset-for-live-test' && request.method === 'POST') {
			return adminDevRoute(env, () => adminDevResetForLiveTest(env));
		}

		return new Response('OmniCharts ingest', {
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	},

	async scheduled(event, env, ctx): Promise<void> {
		const messages = cronToMessages(event.cron, env);
		if (messages.length === 0) return;
		ctx.waitUntil(
			requireIngestQueue(env)
				.sendBatch(messages.map((body) => ({ body })))
				.catch((err) => ingestNonFatalError('scheduled sendBatch failed', err))
		);
	},

	async queue(batch, env): Promise<void> {
		for (const message of batch.messages) {
			try {
				const payload = parseQueueBody(message.body);
				if (!payload) {
					ingestWarn('queue: ack invalid message body (drop)', message.body);
					message.ack();
					continue;
				}
				await handleQueueMessage(payload, env);
				message.ack();
			} catch (err) {
				console.error('queue message failed', err);
				message.retry();
			}
		}
	}
} satisfies ExportedHandler<Env>;

async function handleQueueMessage(payload: IngestQueueMessage, env: Env): Promise<void> {
	switch (payload.type) {
		case 'poll_platform':
			if (payload.platform === 'twitch') {
				await runTwitchPollPlatform(env);
			}
			// Phase 3: Kick/YouTube poll_platform handlers — no-op until ADR-003 ingest ships.
			break;
		case 'poll_kick_tracked':
			await runKickPollPlatform(env);
			break;
		case 'poll_youtube_tracked':
			await runYoutubePollPlatform(env);
			break;
		case 'poll_twitch_sweep':
			await runTwitchSweepAndGamePass(env);
			break;
		case 'poll_twitch_game_pass':
			await runTwitchGamePass(env);
			break;
		case 'poll_twitch_reconcile': {
			const reconcile = await runTwitchReconcileRecent(env);
			const enrichIds = reconcile.platformChannelIds.slice(0, ENRICH_MAX_CHANNELS_PER_RUN);
			if (enrichIds.length > 0) {
				await runTwitchProfileEnrichment(env, {
					platformChannelIds: enrichIds,
					includeFollowers: false
				});
			}
			break;
		}
		case 'poll_twitch_catalog':
			await runTwitchCatalogPoll(env);
			break;
		case 'poll_twitch_enrich':
			await runTwitchProfileEnrichment(env, {
				platformChannelIds: payload.platform_channel_ids,
				includeFollowers: false
			});
			break;
		case 'poll_channel_batch':
			if (payload.platform === 'twitch') {
				await runTwitchPollBatch(env, payload.channel_ids);
			}
			break;
		case 'discover_twitch':
			await runTwitchDiscovery(env);
			break;
		case 'discover_kick': {
			const stats = await runKickDiscovery(env);
			if (stats.categoriesScanned > 0 || stats.streamsSeen > 0) {
				await recordKickDiscoverySeed(requireDb(env), stats);
			}
			break;
		}
		case 'sync_eventsub_twitch':
			await syncTwitchEventSubSubscriptions(env);
			break;
		case 'rollup_daily':
			await runDailyRollup(env, payload.date);
			break;
	}
}

function wantsDetailedHealth(request: Request): boolean {
	const url = new URL(request.url);
	return url.searchParams.get('detailed') === '1';
}

async function healthResponse(request: Request, env: Env): Promise<Response> {
	if (wantsDetailedHealth(request)) {
		const authFailure = requireAdminApiKey(request, env);
		if (authFailure) return authFailure;
		const body = await buildIngestHealth(env);
		return Response.json(body, { status: ingestHealthHttpStatus(body) });
	}
	const body = await buildPublicHealth(env);
	return Response.json(body, { status: ingestHealthHttpStatus(body) });
}

function redirectAdminRankingsToV1(request: Request): Response {
	const target = new URL(request.url);
	if (target.pathname === '/admin/twitch/rankings') {
		target.pathname = '/v1/rankings/channels';
	} else {
		target.pathname = '/v1/rankings/games';
	}
	return Response.redirect(target.toString(), 308);
}

async function adminTwitchDiscover(request: Request, env: Env): Promise<Response> {
	if (!hasTwitchAppCredentials(env)) {
		return twitchAppCredentialsErrorResponse();
	}
	let quick = false;
	try {
		const body = (await request.json()) as { quick?: boolean };
		quick = body.quick === true;
	} catch {
		/* empty body */
	}
	const stats = await runTwitchDiscovery(env, { quick });
	await recordDiscoverySeed(requireDb(env), stats);
	return Response.json({ ok: true, stats, quick });
}

async function adminKickDiscover(request: Request, env: Env): Promise<Response> {
	let quick = false;
	try {
		const body = (await request.json()) as { quick?: boolean };
		quick = body.quick === true;
	} catch {
		/* empty body */
	}
	const stats = await runKickDiscovery(env, { quick });
	if (stats.categoriesScanned > 0 || stats.streamsSeen > 0) {
		await recordKickDiscoverySeed(requireDb(env), stats);
	}
	return Response.json({ ok: true, stats, quick, skipped: stats.categoriesScanned === 0 });
}

async function adminTwitchPoll(request: Request, env: Env): Promise<Response> {
	if (!hasTwitchAppCredentials(env)) {
		return twitchAppCredentialsErrorResponse();
	}
	let quick = false;
	try {
		const body = (await request.json()) as { quick?: boolean };
		quick = body.quick === true;
	} catch {
		/* empty body */
	}
	if (quick) {
		// Catalog poll only hits `tracked` IDs; checkpoint discover leaves most rows as
		// `discovered`. A short global sweep writes viewer_samples like production cron.
		const stats = await runTwitchLiveSweep(env, { maxPages: 3 });
		return Response.json({ ok: true, mode: 'quick_sweep', quick: true, stats });
	}
	const stats = await runTwitchCoverageCycle(env);
	return Response.json({ ok: true, mode: 'coverage_cycle', stats });
}

async function adminTwitchEnrichProfiles(env: Env): Promise<Response> {
	if (!hasTwitchAppCredentials(env)) {
		return twitchAppCredentialsErrorResponse();
	}
	const stats = await runTwitchProfileEnrichment(env);
	return Response.json({ ok: true, mode: 'profile_enrichment', stats });
}

async function adminTwitchPollCatalog(env: Env): Promise<Response> {
	if (!hasTwitchAppCredentials(env)) {
		return twitchAppCredentialsErrorResponse();
	}
	const shards = await enqueueTwitchPollShards(env);
	return Response.json({ ok: true, mode: 'catalog_poll', shards_enqueued: shards });
}

async function adminTwitchEventSubSync(env: Env): Promise<Response> {
	if (!hasTwitchAppCredentials(env)) {
		return twitchAppCredentialsErrorResponse();
	}
	const stats = await syncTwitchEventSubSubscriptions(env);
	return Response.json({ ok: stats.errors === 0, stats });
}

async function adminRollupDaily(request: Request, env: Env): Promise<Response> {
	let date: string | undefined;
	try {
		const json = (await request.json()) as { date?: string };
		date = json.date;
	} catch {
		// empty body → yesterday UTC
	}
	const stats = await runDailyRollup(env, date);
	return Response.json({ ok: true, stats });
}

function rankingsQueryErrorResponse(
	error: 'invalid_period' | 'invalid_limit' | 'invalid_platform'
): Response {
	const messages: Record<typeof error, string> = {
		invalid_period: 'period must be one of 24h, 7d, 30d, 90d',
		invalid_limit: 'limit must be a positive integer',
		invalid_platform: 'platform must be twitch, kick, or youtube'
	};
	return Response.json(
		{
			error: {
				code: error,
				message: messages[error]
			}
		},
		{ status: 400 }
	);
}

function searchQueryErrorResponse(
	error: 'invalid_query' | 'invalid_limit' | 'invalid_platform'
): Response {
	const messages: Record<typeof error, string> = {
		invalid_query: 'q must be between 2 and 100 characters',
		invalid_limit: 'limit must be a positive integer',
		invalid_platform: 'platform must be twitch, kick, or youtube'
	};
	return Response.json(
		{ error: { code: error, message: messages[error] } },
		{ status: 400 }
	);
}

async function publicRankingsChannels(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const parsed = parseRankingsChannelsQuery(url);
	if (!parsed.ok) {
		return rankingsQueryErrorResponse(parsed.error);
	}
	const eligibility = rankingQueryOptionsFromEnv(env);
	const cacheKey = rankingsChannelsCacheKey({
		platform: parsed.platform,
		period: parsed.period,
		limit: parsed.limit,
		minAverageViewers: eligibility.minAverageViewers,
		minAirtimeMinutes: eligibility.minAirtimeMinutes
	});
	const cached = getCachedRankingsChannels(cacheKey);
	if (cached) {
		return new Response(cached, { headers: rankingsResponseHeaders(request) });
	}
	const db = requireDb(env);
	const body = await buildRankingsChannelsResponse(db, {
		platform: parsed.platform,
		period: parsed.period,
		limit: parsed.limit,
		minAverageViewers: eligibility.minAverageViewers,
		minAirtimeMinutes: eligibility.minAirtimeMinutes
	});
	const json = JSON.stringify(body);
	setCachedRankingsChannels(cacheKey, json);
	return new Response(json, { headers: rankingsResponseHeaders(request) });
}

async function publicRankingsGames(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const parsed = parseRankingsGamesQuery(url);
	if (!parsed.ok) {
		return rankingsQueryErrorResponse(parsed.error);
	}
	const eligibility = rankingQueryOptionsFromEnv(env);
	const cacheKey = rankingsGamesCacheKey({
		platform: parsed.platform,
		period: parsed.period,
		limit: parsed.limit,
		minAverageViewers: eligibility.minAverageViewers,
		minAirtimeMinutes: eligibility.minAirtimeMinutes
	});
	const cached = getCachedRankingsGames(cacheKey);
	if (cached) {
		return new Response(cached, { headers: rankingsResponseHeaders(request) });
	}
	const db = requireDb(env);
	const body = await buildRankingsGamesResponse(db, parsed, env);
	const json = JSON.stringify(body);
	setCachedRankingsGames(cacheKey, json);
	return new Response(json, { headers: rankingsResponseHeaders(request) });
}

async function adminDevRoute(env: Env, handler: () => Promise<Response>): Promise<Response> {
	if (!isDevAdminRouteAllowed(env)) {
		return new Response('Not found', { status: 404 });
	}
	return handler();
}

async function adminDevSeedRankings(env: Env): Promise<Response> {
	const stats = await seedDevRankings(env);
	return Response.json({ ok: true, stats });
}

async function adminDevResetForLiveTest(env: Env): Promise<Response> {
	const stats = await clearDevSeedChannels(requireDb(env));
	return Response.json({ ok: true, stats });
}

async function publicChannelResolve(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const slug = url.searchParams.get('slug')?.trim() ?? '';
	const platform = url.searchParams.get('platform') ?? PLATFORM_TWITCH;
	if (!slug) {
		return Response.json(
			{ error: { code: 'bad_request', message: 'slug is required' } },
			{ status: 400 }
		);
	}
	const resolved = await resolveChannelSlug(requireDb(env), { platform, slug });
	if (!resolved) {
		return Response.json(
			{ error: { code: 'not_found', message: 'Channel not found' } },
			{ status: 404 }
		);
	}
	return Response.json(
		{ platform, slug: resolved.slug, from_history: resolved.from_history },
		{
			headers: {
				'cache-control': 'public, max-age=300',
				...corsAllowOrigin(request)
			}
		}
	);
}

async function publicChannelDetail(
	request: Request,
	env: Env,
	slug: string
): Promise<Response> {
	const url = new URL(request.url);
	url.pathname = `/v1/channels/${slug}`;
	const query = parseChannelDetailQuery(url);
	if (!query.ok) {
		return rankingsQueryErrorResponse(query.error);
	}
	const body = await buildChannelDetailResponse(requireDb(env), {
		platform: query.platform,
		slug: query.slug,
		period: query.period
	});
	if (!body) {
		return Response.json(
			{ error: { code: 'not_found', message: 'Channel not found' } },
			{ status: 404 }
		);
	}
	return Response.json(body, {
		headers: {
			'cache-control': 'public, max-age=120',
			...corsAllowOrigin(request)
		}
	});
}

async function publicGameDetail(
	request: Request,
	env: Env,
	slug: string
): Promise<Response> {
	const url = new URL(request.url);
	url.pathname = `/v1/games/${slug}`;
	const query = parseGameDetailQuery(url);
	if (!query.ok) {
		return rankingsQueryErrorResponse(query.error);
	}
	const rankingOpts = rankingQueryOptionsFromEnv(env);
	const body = await buildGameDetailResponse(
		requireDb(env),
		{
			platform: query.platform,
			slug: query.slug,
			period: query.period
		},
		{ minAirtimeMinutes: rankingOpts.minAirtimeMinutes }
	);
	if (!body) {
		return Response.json(
			{ error: { code: 'not_found', message: 'Game not found' } },
			{ status: 404 }
		);
	}
	return Response.json(body, {
		headers: {
			'cache-control': 'public, max-age=120',
			...corsAllowOrigin(request)
		}
	});
}

async function publicSearchChannels(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const parsed = parseSearchChannelsQuery(url);
	if (!parsed.ok) {
		return searchQueryErrorResponse(parsed.error);
	}
	const results = await searchChannels(requireDb(env), {
		platformId: parsed.platformId,
		query: parsed.query,
		limit: parsed.limit
	});
	return Response.json(
		{ results },
		{ headers: { 'cache-control': 'private, max-age=30' } }
	);
}
