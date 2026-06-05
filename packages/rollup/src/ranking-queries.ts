import type { D1Database, D1PreparedStatement } from './d1';
import { MIN_RANKING_AIRTIME_MINUTES } from './eligibility';

export type ChannelRollupQueryRow = {
	slug: string;
	display_name: string;
	avatar_url: string | null;
	first_observed_at: string;
	hours_watched: number;
	average_viewers: number;
	airtime_minutes: number;
	peak_viewers: number;
	stream_count: number;
};

const TOP_CHANNELS_BY_HW_SQL_BASE = `SELECT c.slug, c.display_name, c.avatar_url, c.first_observed_at,
              SUM(r.hours_watched) AS hours_watched,
              SUM(r.airtime_minutes) AS airtime_minutes,
              SUM(r.stream_count) AS stream_count,
              MAX(r.peak_viewers) AS peak_viewers,
              (SUM(r.hours_watched) * 60.0 / NULLIF(SUM(r.airtime_minutes), 0)) AS average_viewers
       FROM channel_daily_rollups r
       INNER JOIN channels c ON c.id = r.channel_id
       WHERE c.platform_id = ?
         AND c.ingest_state = 'tracked'
         AND r.date >= date('now', '-' || ? || ' days')`;

const TOP_CHANNELS_LANGUAGE_FILTER = ` AND lower(c.language) = ?`;

const TOP_CHANNELS_BY_HW_SQL_SUFFIX = ` GROUP BY c.id
       HAVING SUM(r.airtime_minutes) >= ?
         AND (SUM(r.hours_watched) * 60.0 / NULLIF(SUM(r.airtime_minutes), 0)) >= ?
       ORDER BY hours_watched DESC, average_viewers DESC, slug ASC
       LIMIT ?`;

function topChannelsByHoursWatchedSql(language: string | null): string {
	return TOP_CHANNELS_BY_HW_SQL_BASE + (language ? TOP_CHANNELS_LANGUAGE_FILTER : '') + TOP_CHANNELS_BY_HW_SQL_SUFFIX;
}

export function prepareTopChannelsByHoursWatched(
	db: D1Database,
	opts: {
		platformId: string;
		days: number;
		limit: number;
		minAirtimeMinutes?: number;
		minAverageViewers?: number;
		language?: string | null;
	},
): D1PreparedStatement {
	const minAirtime = opts.minAirtimeMinutes ?? MIN_RANKING_AIRTIME_MINUTES;
	const minAv = opts.minAverageViewers ?? 0;
	const language = opts.language ?? null;
	const binds: unknown[] = [opts.platformId, String(opts.days)];
	if (language) binds.push(language);
	binds.push(minAirtime, minAv, opts.limit);
	return db.prepare(topChannelsByHoursWatchedSql(language)).bind(...binds);
}

export async function queryTopChannelsByHoursWatched(
	db: D1Database,
	opts: {
		platformId: string;
		days: number;
		limit: number;
		minAirtimeMinutes?: number;
		minAverageViewers?: number;
		language?: string | null;
	},
): Promise<ChannelRollupQueryRow[]> {
	const { results } = await prepareTopChannelsByHoursWatched(db, opts).all<ChannelRollupQueryRow>();
	return results ?? [];
}

export type GameRollupQueryRow = {
	slug: string;
	name: string;
	hours_watched: number;
	average_viewers: number;
};

const TOP_GAMES_BY_AV_SQL = `SELECT gc.slug, gc.name,
              SUM(r.hours_watched) AS hours_watched,
              (SUM(r.hours_watched) * 60.0 / NULLIF(SUM(r.airtime_minutes), 0)) AS average_viewers
       FROM game_daily_rollups r
       INNER JOIN game_categories gc ON gc.id = r.game_category_id
       INNER JOIN (
         SELECT DISTINCT ss.game_category_id
         FROM stream_sessions ss
         INNER JOIN channels c ON c.id = ss.channel_id
         INNER JOIN channel_daily_rollups cr ON cr.channel_id = c.id
         WHERE c.platform_id = ?
           AND c.ingest_state = 'tracked'
           AND cr.date >= date('now', '-' || ? || ' days')
           AND ss.started_at >= date('now', '-' || ? || ' days')
         GROUP BY ss.game_category_id, c.id
         HAVING SUM(cr.airtime_minutes) >= ?
           AND (SUM(cr.hours_watched) * 60.0 / NULLIF(SUM(cr.airtime_minutes), 0)) >= ?
       ) eligible ON eligible.game_category_id = gc.id
       WHERE gc.platform_id = ?
         AND r.date >= date('now', '-' || ? || ' days')
       GROUP BY gc.id
       HAVING SUM(r.airtime_minutes) >= ?
       ORDER BY average_viewers DESC, hours_watched DESC, gc.slug ASC
       LIMIT ?`;

export function prepareTopGamesByAverageViewers(
	db: D1Database,
	opts: {
		platformId: string;
		days: number;
		limit: number;
		minAirtimeMinutes?: number;
		minAverageViewers?: number;
	},
): D1PreparedStatement {
	const minAirtime = opts.minAirtimeMinutes ?? MIN_RANKING_AIRTIME_MINUTES;
	const minAv = opts.minAverageViewers ?? 0;
	const days = String(opts.days);
	return db
		.prepare(TOP_GAMES_BY_AV_SQL)
		.bind(opts.platformId, days, days, minAirtime, minAv, opts.platformId, days, minAirtime, opts.limit);
}

export async function queryTopGamesByAverageViewers(
	db: D1Database,
	opts: {
		platformId: string;
		days: number;
		limit: number;
		minAirtimeMinutes?: number;
		minAverageViewers?: number;
	},
): Promise<GameRollupQueryRow[]> {
	const { results } = await prepareTopGamesByAverageViewers(db, opts).all<GameRollupQueryRow>();
	return results ?? [];
}
