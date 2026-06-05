import {
	DISCOVERY_GAMES_TO_SCAN,
	DISCOVERY_MAX_PAGES_PER_GAME,
	ENRICH_MAX_CHANNELS_PER_RUN,
	TOP_GAMES_FIRST,
	minViewersFromEnv
} from './config';
import { runTwitchProfileEnrichment } from './enrich-profiles';
import { shouldContinueHelixPagination } from './helix-pagination';
import { TwitchHelixClient } from './helix';
import { upsertGameCategory, type DiscoveryStats } from '../db/twitch';
import { writeCachedTopGames } from './top-games-cache';
import { ingestNonFatalError } from '../log';
import { ingestStreamPage } from './stream-page';
import { requireDb } from '../worker-bindings';

export type TwitchDiscoveryOptions = {
	/** Fewer Helix pages — used by Phase 1 checkpoint (still hits real APIs). */
	quick?: boolean;
};

export async function runTwitchDiscovery(
	env: Env,
	opts: TwitchDiscoveryOptions = {}
): Promise<DiscoveryStats> {
	const db = requireDb(env);
	const client = new TwitchHelixClient(env);
	const minViewers = minViewersFromEnv(env);
	const gamesToScan = opts.quick ? 3 : DISCOVERY_GAMES_TO_SCAN;
	const maxPagesPerGame = opts.quick ? 2 : DISCOVERY_MAX_PAGES_PER_GAME;
	const enrichCap = opts.quick ? 0 : ENRICH_MAX_CHANNELS_PER_RUN;
	const pageStats = {
		streamsSeen: 0,
		channelsIngested: 0,
		duplicatesSkipped: 0
	};
	const stats: DiscoveryStats = {
		gamesScanned: 0,
		pagesFetched: 0,
		streamsSeen: 0,
		channelsUpserted: 0
	};

	const topGames = await client.getTopGames(TOP_GAMES_FIRST);
	await writeCachedTopGames(db, topGames);
	const games = topGames.slice(0, gamesToScan);
	const seenUserIds = new Set<string>();

	for (const game of games) {
		stats.gamesScanned++;
		await upsertGameCategory(db, game);

		let cursor: string | undefined;
		let consecutiveEmptyPages = 0;
		for (let page = 0; page < maxPagesPerGame; page++) {
			const pageResult = await client.getStreamsByGameId(game.id, {
				first: 100,
				after: cursor
			});
			stats.pagesFetched++;

			const streams = pageResult.data ?? [];
			if (streams.length === 0) {
				if (
					shouldContinueHelixPagination(streams, pageResult.pagination, consecutiveEmptyPages)
				) {
					consecutiveEmptyPages++;
					cursor = pageResult.pagination!.cursor;
					continue;
				}
				break;
			}
			consecutiveEmptyPages = 0;

			const { pageMaxViewers } = await ingestStreamPage(
				env,
				streams,
				minViewers,
				seenUserIds,
				pageStats
			);
			stats.streamsSeen = pageStats.streamsSeen;
			stats.channelsUpserted = pageStats.channelsIngested;

			if (pageMaxViewers < minViewers) break;

			cursor = pageResult.pagination?.cursor;
			if (!cursor) break;
		}
	}

	const enrichIds = [...seenUserIds].slice(0, enrichCap);
	if (enrichIds.length > 0) {
		try {
			await runTwitchProfileEnrichment(env, { platformChannelIds: enrichIds });
		} catch (err) {
			ingestNonFatalError('discovery profile enrichment failed (non-fatal)', err);
		}
	}

	return stats;
}
