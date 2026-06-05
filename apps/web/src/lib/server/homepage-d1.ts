import { PLATFORM_TWITCH, parseRankingPeriod, periodToDays } from '@omnicharts/domain';
import {
	countFromBatchRow,
	formatCompactMetric,
	formatHoursWatched,
	prepareTopChannelsByHoursWatched,
	prepareTopGamesByAverageViewers,
	rankTopChannelsFromRollupRows,
	rankTopGamesFromRollupRows,
	TWITCH_LIVE_COUNT_SQL,
	TWITCH_TRACKED_COUNT_SQL,
	type ChannelRollupQueryRow,
	type D1BatchResult,
	type GameRollupQueryRow
} from '@omnicharts/rollup';
import type { ChannelRankingsLoad } from '$lib/server/rankings';
import type { GameRankingsLoad } from '$lib/server/game-rankings';
import type { WebRankingEnv } from '$lib/server/ranking-env';
import { webRankingEligibility } from '$lib/server/ranking-env';
import type { Period } from '$lib/mock/home';
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
	period: Period,
	channelLimit: number,
	gameLimit: number,
	cfEnv: WebRankingEnv | null = null
): Promise<HomepageD1Snapshot> {
	const apiPeriod = parseRankingPeriod(periodForApi(period));
	const days = periodToDays(apiPeriod);
	const eligibility = webRankingEligibility(cfEnv, PLATFORM_TWITCH);
	const channelQueryLimit = Math.min(channelLimit * 2, 200);
	const updatedAt = new Date().toISOString();

	type CfStmt = ReturnType<D1Database['prepare']>;
	const [trackedBatch, liveBatch, channelsBatch, gamesBatch] = await db.batch([
		db.prepare(TWITCH_TRACKED_COUNT_SQL).bind(PLATFORM_TWITCH),
		db.prepare(TWITCH_LIVE_COUNT_SQL).bind(PLATFORM_TWITCH),
		prepareTopChannelsByHoursWatched(db, {
			platformId: PLATFORM_TWITCH,
			days,
			limit: channelQueryLimit,
			minAirtimeMinutes: eligibility.minAirtimeMinutes,
			minAverageViewers: eligibility.minAverageViewers
		}) as unknown as CfStmt,
		prepareTopGamesByAverageViewers(db, {
			platformId: PLATFORM_TWITCH,
			days,
			limit: gameLimit,
			minAirtimeMinutes: eligibility.minAirtimeMinutes,
			minAverageViewers: eligibility.minAverageViewers
		}) as unknown as CfStmt
	]);

	const channelRows = rankTopChannelsFromRollupRows(
		(channelsBatch.results ?? []) as ChannelRollupQueryRow[],
		channelLimit
	);
	const gameRows = rankTopGamesFromRollupRows(
		(gamesBatch.results ?? []) as GameRollupQueryRow[],
		gameLimit
	);

	return {
		status: 'ok',
		trackedChannels: countFromBatchRow(trackedBatch as D1BatchResult),
		channelsLive: countFromBatchRow(liveBatch as D1BatchResult),
		channelRankings: {
			source: 'live',
			period,
			updatedAt,
			rows: channelRows.map((item) => ({
				rank: item.rank,
				slug: item.slug,
				displayName: item.displayName,
				platform: 'twitch',
				avatarUrl: item.avatarUrl ?? '',
				metric: formatHoursWatched(item.hoursWatched),
				metricLabel: 'Hours watched'
			}))
		},
		gameRankings: {
			source: 'live',
			period,
			updatedAt,
			rows: gameRows.map((item) => ({
				rank: item.rank,
				slug: item.slug,
				name: item.name,
				platform: 'twitch',
				boxArtUrl: '',
				metric: formatCompactMetric(item.averageViewers),
				metricLabel: 'Avg viewers'
			}))
		}
	};
}
