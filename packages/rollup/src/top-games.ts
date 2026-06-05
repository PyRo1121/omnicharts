import { PLATFORM_TWITCH } from '@omnicharts/domain';
import type { D1Database } from './d1';
import { queryTopGamesByAverageViewers, type GameRollupQueryRow } from './ranking-queries';

export type TopGameRanking = {
	rank: number;
	slug: string;
	name: string;
	averageViewers: number;
	hoursWatched: number;
};

export function rankTopGamesFromRollupRows(
	rows: GameRollupQueryRow[],
	limit: number
): TopGameRanking[] {
	return rows.slice(0, limit).map((r, i) => ({
		rank: i + 1,
		slug: r.slug,
		name: r.name,
		averageViewers: r.average_viewers,
		hoursWatched: r.hours_watched
	}));
}

export async function getTopTwitchGamesByAverageViewers(
	db: D1Database,
	opts: {
		days?: number;
		limit?: number;
		minAirtimeMinutes?: number;
		minAverageViewers?: number;
	} = {}
): Promise<TopGameRanking[]> {
	const days = opts.days ?? 7;
	const limit = Math.min(opts.limit ?? 20, 100);

	const rows = await queryTopGamesByAverageViewers(db, {
		platformId: PLATFORM_TWITCH,
		days,
		limit,
		minAirtimeMinutes: opts.minAirtimeMinutes,
		minAverageViewers: opts.minAverageViewers
	});

	return rankTopGamesFromRollupRows(rows, limit);
}
