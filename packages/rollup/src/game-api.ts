import {
	isPlatformId,
	PLATFORM_TWITCH,
	parseRankingPeriod,
	periodToDays,
	type RankingPeriod
} from '@omnicharts/domain';
import { MIN_RANKING_AIRTIME_MINUTES } from './eligibility';
import type { D1Database } from './d1';

export type GameTopChannelItem = {
	rank: number;
	slug: string;
	display_name: string;
	avatar_url: string | null;
	hours_watched: number;
};

export type GameDetailDaily = {
	date: string;
	hours_watched: number;
	average_viewers: number;
	peak_viewers: number;
	airtime_hours: number;
	live_channels: number;
};

export type GameDetailResponse = {
	platform: string;
	slug: string;
	name: string;
	period: RankingPeriod;
	totals: {
		hours_watched: number;
		average_viewers: number;
		peak_viewers: number;
		airtime_hours: number;
		live_channels: number;
	};
	daily: GameDetailDaily[];
	top_channels: GameTopChannelItem[];
};

export type GameDetailBuildOpts = {
	minAirtimeMinutes?: number;
	topChannelsLimit?: number;
};

type GameRow = {
	id: string;
	slug: string;
	name: string;
};

type RollupRow = {
	date: string;
	hours_watched: number;
	average_viewers: number;
	peak_viewers: number;
	airtime_minutes: number;
	live_channels: number;
};

export type GameDetailQueryError = 'invalid_platform';

export type ParsedGameDetailQuery =
	| { ok: true; platform: string; period: RankingPeriod; slug: string }
	| { ok: false; error: GameDetailQueryError };

export function parseGameDetailQuery(url: URL): ParsedGameDetailQuery {
	const platformRaw = url.searchParams.get('platform') ?? PLATFORM_TWITCH;
	if (!isPlatformId(platformRaw)) {
		return { ok: false, error: 'invalid_platform' };
	}
	const period = parseRankingPeriod(url.searchParams.get('period'));
	const parts = url.pathname.split('/').filter(Boolean);
	const slug = decodeURIComponent(parts[parts.length - 1] ?? '');
	return { ok: true, platform: platformRaw, period, slug };
}

type TopChannelQueryRow = {
	slug: string;
	display_name: string;
	avatar_url: string | null;
	hours_watched: number;
};

export async function buildGameTopChannels(
	db: D1Database,
	opts: {
		platform: string;
		gameSlug: string;
		period: RankingPeriod;
		minAirtimeMinutes?: number;
		limit?: number;
	}
): Promise<GameTopChannelItem[]> {
	if (!opts.gameSlug) return [];

	const days = periodToDays(opts.period);
	const minAirtime = opts.minAirtimeMinutes ?? MIN_RANKING_AIRTIME_MINUTES;
	const limit = opts.limit ?? 10;

	const { results } = await db
		.prepare(
			`SELECT c.slug, c.display_name, c.avatar_url,
              SUM(r.hours_watched) AS hours_watched
       FROM channel_daily_rollups r
       INNER JOIN channels c ON c.id = r.channel_id
       INNER JOIN stream_sessions ss ON ss.channel_id = c.id
       INNER JOIN game_categories gc ON gc.id = ss.game_category_id
       WHERE gc.platform_id = ?
         AND lower(gc.slug) = lower(?)
         AND c.ingest_state = 'tracked'
         AND r.date >= date('now', '-' || ? || ' days')
         AND ss.started_at >= date('now', '-' || ? || ' days')
       GROUP BY c.id
       HAVING SUM(r.airtime_minutes) >= ?
       ORDER BY hours_watched DESC,
                (SUM(r.hours_watched) * 60.0 / NULLIF(SUM(r.airtime_minutes), 0)) DESC,
                c.slug ASC
       LIMIT ?`
		)
		.bind(opts.platform, opts.gameSlug, String(days), String(days), minAirtime, limit)
		.all<TopChannelQueryRow>();

	return (results ?? []).map((row, index) => ({
		rank: index + 1,
		slug: row.slug,
		display_name: row.display_name,
		avatar_url: row.avatar_url,
		hours_watched: Math.round(row.hours_watched)
	}));
}

export async function buildGameDetailResponse(
	db: D1Database,
	opts: { platform: string; slug: string; period: RankingPeriod },
	detailOpts?: GameDetailBuildOpts
): Promise<GameDetailResponse | null> {
	if (!opts.slug) return null;

	const game = await db
		.prepare(
			`SELECT id, slug, name
       FROM game_categories
       WHERE platform_id = ? AND lower(slug) = lower(?)`
		)
		.bind(opts.platform, opts.slug)
		.first<GameRow>();

	if (!game) return null;

	const days = periodToDays(opts.period);
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);

	const { results } = await db
		.prepare(
			`SELECT date, hours_watched, average_viewers, peak_viewers,
              airtime_minutes, live_channels
       FROM game_daily_rollups
       WHERE game_category_id = ? AND date >= ?
       ORDER BY date ASC`
		)
		.bind(game.id, since)
		.all<RollupRow>();

	const dailyRows = results ?? [];
	const daily: GameDetailDaily[] = dailyRows.map((r) => ({
		date: r.date,
		hours_watched: Math.round(r.hours_watched),
		average_viewers: Math.round(r.average_viewers),
		peak_viewers: r.peak_viewers,
		airtime_hours: Math.round((r.airtime_minutes / 60) * 10) / 10,
		live_channels: r.live_channels
	}));

	const sumHw = dailyRows.reduce((a, r) => a + r.hours_watched, 0);
	const sumAirtimeMin = dailyRows.reduce((a, r) => a + r.airtime_minutes, 0);
	const peak = dailyRows.reduce((m, r) => Math.max(m, r.peak_viewers), 0);
	const liveChannels = dailyRows.reduce((m, r) => Math.max(m, r.live_channels), 0);

	const top_channels = await buildGameTopChannels(db, {
		platform: opts.platform,
		gameSlug: game.slug,
		period: opts.period,
		minAirtimeMinutes: detailOpts?.minAirtimeMinutes,
		limit: detailOpts?.topChannelsLimit
	});

	return {
		platform: opts.platform,
		slug: game.slug,
		name: game.name,
		period: opts.period,
		totals: {
			hours_watched: Math.round(sumHw),
			average_viewers:
				sumAirtimeMin > 0
					? Math.round((sumHw / (sumAirtimeMin / 60)) * 10) / 10
					: 0,
			peak_viewers: peak,
			airtime_hours: Math.round((sumAirtimeMin / 60) * 10) / 10,
			live_channels: liveChannels
		},
		daily,
		top_channels
	};
}
