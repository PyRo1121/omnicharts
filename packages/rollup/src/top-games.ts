import { PLATFORM_TWITCH } from '@omnicharts/domain';
import type { D1Database } from './d1';
import { queryTopGamesByAverageViewers, type GameRollupQueryRow } from './ranking-queries';
import { sortGamesByAverageViewers } from './sort';

export type TopGameRanking = {
	rank: number;
	slug: string;
	name: string;
	averageViewers: number;
	hoursWatched: number;
};

export function rankTopGamesFromRollupRows(rows: GameRollupQueryRow[], limit: number): TopGameRanking[] {
	const bySlug = new Map(rows.map((r) => [r.slug, r]));
	const sorted = sortGamesByAverageViewers(
		rows.map((r) => ({
			slug: r.slug,
			averageViewers: r.average_viewers,
			hoursWatched: r.hours_watched,
		})),
	);
	return sorted.slice(0, limit).map((r, i) => {
		const row = bySlug.get(r.slug);
		return {
			rank: i + 1,
			slug: r.slug,
			name: row?.name ?? r.slug,
			averageViewers: r.averageViewers,
			hoursWatched: r.hoursWatched,
		};
	});
}

export async function getTopGamesByAverageViewers(
	db: D1Database,
	opts: {
		platformId: string;
		days?: number;
		limit?: number;
		minAirtimeMinutes?: number;
		minAverageViewers?: number;
	},
): Promise<TopGameRanking[]> {
	const days = opts.days ?? 7;
	const limit = Math.min(opts.limit ?? 20, 100);

	const rows = await queryTopGamesByAverageViewers(db, {
		platformId: opts.platformId,
		days,
		limit,
		minAirtimeMinutes: opts.minAirtimeMinutes,
		minAverageViewers: opts.minAverageViewers,
	});

	return rankTopGamesFromRollupRows(rows, limit);
}

export async function getTopTwitchGamesByAverageViewers(
	db: D1Database,
	opts: {
		days?: number;
		limit?: number;
		minAirtimeMinutes?: number;
		minAverageViewers?: number;
	} = {},
): Promise<TopGameRanking[]> {
	return getTopGamesByAverageViewers(db, { platformId: PLATFORM_TWITCH, ...opts });
}
