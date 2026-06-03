/**
 * OmniCharts ingest Worker — cron enqueues; consumer polls platforms (Phase 1+).
 * @see docs/15-ingest-runbook.md
 */

import { parseQueueBody, type IngestQueueMessage } from './messages';
import { runTwitchDiscovery } from './twitch/discover';
import { enqueueTwitchPollShards, runTwitchPollBatch } from './twitch/poll';
import { runTwitchLiveSweep } from './twitch/sweep';
import { runTwitchCoverageCycle } from './twitch/coverage';
import { runTwitchGamePass } from './twitch/game-pass';
import { runTwitchReconcileRecent } from './twitch/reconcile';
import { runTwitchPollPlatform } from './twitch/poll-platform';
import { checkPublicRateLimit } from './http/rate-limit';
import { ENRICH_MAX_CHANNELS_PER_RUN } from './twitch/config';
import { runTwitchProfileEnrichment } from './twitch/enrich-profiles';
import { handleTwitchEventSubWebhook } from './twitch/eventsub/handler';
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
import { searchChannels } from './search/channels';
import { TWITCH_PLATFORM_ID } from './twitch/config';
import { hasTwitchAppCredentials, twitchAppCredentialsErrorResponse } from './twitch/credentials';
import { isDevAdminRouteAllowed } from './dev/admin-guard';
import { clearDevSeedChannels } from './dev/clear-seed';
import { seedDevRankings } from './dev/seed-rankings';
import { recordDiscoverySeed } from './discovery/seed';
import { rankingQueryOptionsFromEnv } from './ranking/rollup-queries';
import { isAdminPostPath, isAdminRankingsGetPath, requireAdminApiKey } from './admin/auth';
import { cronToMessages } from './cron-messages';

export default {
	async fetch(request, env): Promise<Response> {
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
			return handleTwitchEventSubWebhook(request, env);
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
		const messages = cronToMessages(event.cron);
		if (messages.length === 0) return;
		ctx.waitUntil(
			env.INGEST_QUEUE.sendBatch(messages.map((body) => ({ body })))
		);
	},

	async queue(batch, env): Promise<void> {
		for (const message of batch.messages) {
			try {
				const payload = parseQueueBody(message.body);
				if (!payload) {
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
			break;
		case 'poll_twitch_sweep':
			await runTwitchLiveSweep(env);
			break;
		case 'poll_twitch_game_pass':
			await runTwitchGamePass(env);
			break;
		case 'poll_twitch_reconcile': {
			const reconcile = await runTwitchReconcileRecent(env);
			const enrichIds = reconcile.platformChannelIds.slice(0, ENRICH_MAX_CHANNELS_PER_RUN);
			if (enrichIds.length > 0) {
				await env.INGEST_QUEUE.sendBatch([
					{
						body: {
							type: 'poll_twitch_enrich',
							platform_channel_ids: enrichIds
						}
					}
				]);
			}
			break;
		}
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
	await recordDiscoverySeed(env.DB, stats);
	return Response.json({ ok: true, stats, quick });
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

async function publicRankingsChannels(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const parsed = parseRankingsChannelsQuery(url);
	if (!parsed.ok) {
		return Response.json(
			{
				error: {
					code: parsed.error,
					message:
						parsed.error === 'invalid_period'
							? 'period must be one of 24h, 7d, 30d, 90d'
							: 'limit must be a positive integer'
				}
			},
			{ status: 400 }
		);
	}
	const eligibility = rankingQueryOptionsFromEnv(env);
	const body = await buildRankingsChannelsResponse(env.DB, {
		platform: parsed.platform,
		period: parsed.period,
		limit: parsed.limit,
		minAverageViewers: eligibility.minAverageViewers,
		minAirtimeMinutes: eligibility.minAirtimeMinutes
	});
	return Response.json(body, {
		headers: {
			'cache-control': 'public, max-age=60',
			'access-control-allow-origin': '*'
		}
	});
}

async function publicRankingsGames(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const query = parseRankingsGamesQuery(url);
	const body = await buildRankingsGamesResponse(env.DB, query, env);
	return Response.json(body, {
		headers: {
			'cache-control': 'public, max-age=60',
			'access-control-allow-origin': '*'
		}
	});
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
	const stats = await clearDevSeedChannels(env.DB);
	return Response.json({ ok: true, stats });
}

async function publicChannelResolve(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const slug = url.searchParams.get('slug')?.trim() ?? '';
	const platform = url.searchParams.get('platform') ?? TWITCH_PLATFORM_ID;
	if (!slug) {
		return Response.json(
			{ error: { code: 'bad_request', message: 'slug is required' } },
			{ status: 400 }
		);
	}
	const resolved = await resolveChannelSlug(env.DB, { platform, slug });
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
				'access-control-allow-origin': '*'
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
	const body = await buildChannelDetailResponse(env.DB, {
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
			'access-control-allow-origin': '*'
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
	const body = await buildGameDetailResponse(env.DB, {
		platform: query.platform,
		slug: query.slug,
		period: query.period
	});
	if (!body) {
		return Response.json(
			{ error: { code: 'not_found', message: 'Game not found' } },
			{ status: 404 }
		);
	}
	return Response.json(body, {
		headers: {
			'cache-control': 'public, max-age=120',
			'access-control-allow-origin': '*'
		}
	});
}

async function publicSearchChannels(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const q = url.searchParams.get('q') ?? '';
	const platform = url.searchParams.get('platform') ?? TWITCH_PLATFORM_ID;
	const limit = Number(url.searchParams.get('limit') ?? '10');
	const results = await searchChannels(env.DB, { platformId: platform, query: q, limit });
	return Response.json(
		{ results },
		{ headers: { 'cache-control': 'private, max-age=30' } }
	);
}
