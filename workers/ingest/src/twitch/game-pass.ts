import { DISCOVERY_MAX_PAGES_PER_GAME, TOP_GAMES_FIRST, minViewersFromEnv } from './config';
import { gamePassGamesPerCycleFromEnv } from './helix-budget';
import { TwitchHelixClient } from './helix';
import { upsertGameCategory } from '../db/twitch';
import { helixBudgetAllowsFetch, helixBudgetGamesPerCycle, helixBudgetPageCap } from './rate-limit';
import { shouldContinueHelixPagination } from './helix-pagination';
import { resolveTopGamesForCoverage } from './top-games-cache';
import { ingestStreamPage, type StreamPageIngestStats } from './stream-page';
import { requireDb } from '../worker-bindings';

export type GamePassStats = StreamPageIngestStats & {
	gamesScanned: number;
	pagesFetched: number;
	startGameIndex: number;
	topGamesHelixPoints: number;
};

export type GamePassOptions = {
	/** Shared client for sequential coverage (one budget across sweep + game pass + reconcile). */
	client?: TwitchHelixClient;
	/** Dedupe user_ids across sweep and game pass in the same cycle. */
	seenUserIds?: Set<string>;
};

/**
 * Rotating per-game directory pass — different slice of Twitch than global sweep.
 * Mitigates Helix "dynamic list" omissions (docs/api/guide#pagination).
 */
export async function runTwitchGamePass(env: Env, opts: GamePassOptions = {}): Promise<GamePassStats> {
	const db = requireDb(env);
	const client = opts.client ?? new TwitchHelixClient(env);
	const minViewers = minViewersFromEnv(env);
	const seenUserIds = opts.seenUserIds ?? new Set<string>();
	const stats: GamePassStats = {
		gamesScanned: 0,
		pagesFetched: 0,
		streamsSeen: 0,
		channelsIngested: 0,
		duplicatesSkipped: 0,
		startGameIndex: 0,
		topGamesHelixPoints: 0,
	};

	const { games: topGames, helixPointsUsed } = await resolveTopGamesForCoverage(client, db, TOP_GAMES_FIRST);
	stats.topGamesHelixPoints = helixPointsUsed;
	if (topGames.length === 0) return stats;

	const startGameIndex = Math.floor(Date.now() / 60_000) % Math.max(1, topGames.length);
	stats.startGameIndex = startGameIndex;

	const gamesPerCycle = helixBudgetGamesPerCycle(client.getBudget(), gamePassGamesPerCycleFromEnv(env));

	for (let g = 0; g < gamesPerCycle; g++) {
		const game = topGames[(startGameIndex + g) % topGames.length];
		stats.gamesScanned++;
		await upsertGameCategory(db, game);

		const pageLimit = helixBudgetPageCap(client.getBudget(), DISCOVERY_MAX_PAGES_PER_GAME);
		let cursor: string | undefined;
		let consecutiveEmptyPages = 0;
		for (let page = 0; page < pageLimit; page++) {
			if (!helixBudgetAllowsFetch(client.getBudget())) break;

			const pageResult = await client.getStreamsByGameId(game.id, {
				first: 100,
				after: cursor,
			});
			stats.pagesFetched++;

			const streams = pageResult.data ?? [];
			if (streams.length === 0) {
				if (shouldContinueHelixPagination(streams, pageResult.pagination, consecutiveEmptyPages)) {
					consecutiveEmptyPages++;
					cursor = pageResult.pagination!.cursor;
					continue;
				}
				break;
			}
			consecutiveEmptyPages = 0;

			const { pageMaxViewers } = await ingestStreamPage(env, streams, minViewers, seenUserIds, stats);

			if (pageMaxViewers < minViewers) break;

			cursor = pageResult.pagination?.cursor;
			if (!cursor) break;
		}
	}

	return stats;
}
