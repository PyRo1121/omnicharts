import { PLATFORM_TWITCH, parseRankingPeriod, periodToDays } from '@omnicharts/domain';
import {
	countFromBatchRow,
	formatCompactMetric,
	formatHoursWatched,
	normalizeBatchResult,
	prepareTopChannelsByHoursWatched,
	prepareTopGamesByAverageViewers,
	rankTopChannelsFromRollupRows,
	rankTopGamesFromRollupRows,
	TWITCH_LIVE_COUNT_SQL,
	TWITCH_TRACKED_COUNT_SQL,
	type ChannelRollupQueryRow,
	type GameRollupQueryRow,
} from '@omnicharts/rollup';
import type { ChannelRankingsLoad } from '$lib/server/rankings';
import type { GameRankingsLoad } from '$lib/server/game-rankings';
import type { WebRankingEnv } from '$lib/server/ranking-env';
import { webRankingEligibility } from '$lib/server/ranking-env';
import type { RankingPeriod } from '$lib/mock/home';
import { periodForApi } from '$lib/server/period-api';

/** Homepage: one D1 batch for counts + rollup rankings (docs/11). */
export type HomepageD1Snapshot = {
	status: 'ok' | 'unavailable';
	trackedChannels: number;
	channelsLive: number;
	channelRankings: ChannelRankingsLoad;
	gameRankings: GameRankingsLoad;
};

export async function loadHomepageFromD1(
	db: D1Database,
	period: RankingPeriod,
	channelLimit: number,
	gameLimit: number,
	cfEnv: WebRankingEnv | null = null,
): Promise<HomepageD1Snapshot> {
	const apiPeriod = parseRankingPeriod(periodForApi(period));
	const days = periodToDays(apiPeriod);
	const eligibility = webRankingEligibility(cfEnv, PLATFORM_TWITCH);
	const channelQueryLimit = Math.min(channelLimit * 2, 200);
	const updatedAt = new Date().toISOString();
	const rankingOpts = {
		platformId: PLATFORM_TWITCH,
		days,
		minAirtimeMinutes: eligibility.minAirtimeMinutes,
		minAverageViewers: eligibility.minAverageViewers,
	};

	const channelStmt = prepareTopChannelsByHoursWatched(db, { ...rankingOpts, limit: channelQueryLimit });
	const gameStmt = prepareTopGamesByAverageViewers(db, { ...rankingOpts, limit: gameLimit });
	const [trackedBatch, liveBatch, channelBatch, gameBatch] = await db.batch([
		db.prepare(TWITCH_TRACKED_COUNT_SQL).bind(PLATFORM_TWITCH),
		db.prepare(TWITCH_LIVE_COUNT_SQL).bind(PLATFORM_TWITCH),
		channelStmt as D1PreparedStatement,
		gameStmt as D1PreparedStatement,
	]);
	const channelRows = (normalizeBatchResult(channelBatch).results ?? []) as ChannelRollupQueryRow[];
	const gameRows = (normalizeBatchResult(gameBatch).results ?? []) as GameRollupQueryRow[];

	const rankedChannels = rankTopChannelsFromRollupRows(channelRows, channelLimit);
	const rankedGames = rankTopGamesFromRollupRows(gameRows, gameLimit);

	return {
		status: 'ok',
		trackedChannels: countFromBatchRow(normalizeBatchResult(trackedBatch)),
		channelsLive: countFromBatchRow(normalizeBatchResult(liveBatch)),
		channelRankings: {
			source: 'live',
			period,
			updatedAt,
			rows: rankedChannels.map((item) => ({
				rank: item.rank,
				slug: item.slug,
				displayName: item.displayName,
				platform: 'twitch',
				avatarUrl: item.avatarUrl ?? '',
				metric: formatHoursWatched(item.hoursWatched),
				metricLabel: 'Hours watched',
			})),
		},
		gameRankings: {
			source: 'live',
			period,
			updatedAt,
			rows: rankedGames.map((item) => ({
				rank: item.rank,
				slug: item.slug,
				name: item.name,
				platform: 'twitch',
				boxArtUrl: '',
				metric: formatCompactMetric(item.averageViewers),
				metricLabel: 'Avg viewers',
			})),
		},
	};
}
