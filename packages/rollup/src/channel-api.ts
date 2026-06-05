import { PLATFORM_TWITCH, isPlatformId, isRankingPeriod, parseRankingPeriod, periodToDays, type RankingPeriod } from '@omnicharts/domain';
import type { D1Database } from './d1';

export type ChannelDetailDaily = {
	date: string;
	hours_watched: number;
	average_viewers: number;
	peak_viewers: number;
	airtime_hours: number;
	stream_count: number;
};

export type ChannelDetailResponse = {
	platform: string;
	slug: string;
	display_name: string;
	avatar_url: string | null;
	language: string | null;
	tracked_since: string | null;
	ingest_state: string;
	follower_count: number | null;
	description: string | null;
	period: RankingPeriod;
	totals: {
		hours_watched: number;
		average_viewers: number;
		peak_viewers: number;
		airtime_hours: number;
		stream_count: number;
		followers_gain: number | null;
	};
	daily: ChannelDetailDaily[];
};

type ChannelRow = {
	id: string;
	slug: string;
	display_name: string;
	avatar_url: string | null;
	language: string | null;
	first_observed_at: string;
	ingest_state: string;
	follower_count: number | null;
	description: string | null;
};

type RollupRow = {
	date: string;
	hours_watched: number;
	average_viewers: number;
	peak_viewers: number;
	airtime_minutes: number;
	stream_count: number;
	followers_delta: number | null;
};

export async function resolveChannelSlug(
	db: D1Database,
	opts: { platform: string; slug: string },
): Promise<{ slug: string; from_history: boolean } | null> {
	if (!opts.slug) return null;

	const current = await db
		.prepare(`SELECT slug FROM channels WHERE platform_id = ? AND lower(slug) = lower(?)`)
		.bind(opts.platform, opts.slug)
		.first<{ slug: string }>();

	if (current) return { slug: current.slug, from_history: false };

	const history = await db
		.prepare(
			`SELECT new_slug FROM slug_history
       WHERE platform_id = ? AND lower(old_slug) = lower(?)
       ORDER BY changed_at DESC
       LIMIT 1`,
		)
		.bind(opts.platform, opts.slug)
		.first<{ new_slug: string }>();

	if (history) return { slug: history.new_slug, from_history: true };
	return null;
}

export type ChannelDetailQueryError = 'invalid_platform' | 'invalid_period';

export type ParsedChannelDetailQuery =
	| { ok: true; platform: string; period: RankingPeriod; slug: string }
	| { ok: false; error: ChannelDetailQueryError };

export function parseChannelDetailQuery(url: URL): ParsedChannelDetailQuery {
	const platformRaw = url.searchParams.get('platform') ?? PLATFORM_TWITCH;
	if (!isPlatformId(platformRaw)) {
		return { ok: false, error: 'invalid_platform' };
	}
	const periodRaw = url.searchParams.get('period');
	if (periodRaw != null && periodRaw !== '' && !isRankingPeriod(periodRaw)) {
		return { ok: false, error: 'invalid_period' };
	}
	const period = parseRankingPeriod(periodRaw);
	const parts = url.pathname.split('/').filter(Boolean);
	const slug = decodeURIComponent(parts[parts.length - 1] ?? '');
	return { ok: true, platform: platformRaw, period, slug };
}

export async function buildChannelDetailResponse(
	db: D1Database,
	opts: { platform: string; slug: string; period: RankingPeriod },
): Promise<ChannelDetailResponse | null> {
	if (!opts.slug) return null;

	const resolved = await resolveChannelSlug(db, {
		platform: opts.platform,
		slug: opts.slug,
	});
	if (!resolved) return null;

	const channel = await db
		.prepare(
			`SELECT id, slug, display_name, avatar_url, language, first_observed_at,
              ingest_state, follower_count, description
       FROM channels
       WHERE platform_id = ? AND slug = ?`,
		)
		.bind(opts.platform, resolved.slug)
		.first<ChannelRow>();

	if (!channel) return null;

	const days = periodToDays(opts.period);
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	const { results } = await db
		.prepare(
			`SELECT date, hours_watched, average_viewers, peak_viewers,
              airtime_minutes, stream_count, followers_delta
       FROM channel_daily_rollups
       WHERE channel_id = ? AND date >= ?
       ORDER BY date ASC`,
		)
		.bind(channel.id, since)
		.all<RollupRow>();

	const dailyRows = results ?? [];
	const daily: ChannelDetailDaily[] = dailyRows.map((r) => ({
		date: r.date,
		hours_watched: Math.round(r.hours_watched),
		average_viewers: Math.round(r.average_viewers),
		peak_viewers: r.peak_viewers,
		airtime_hours: Math.round((r.airtime_minutes / 60) * 10) / 10,
		stream_count: r.stream_count,
	}));

	const sumHw = dailyRows.reduce((a, r) => a + r.hours_watched, 0);
	const sumAirtimeMin = dailyRows.reduce((a, r) => a + r.airtime_minutes, 0);
	const peak = dailyRows.reduce((m, r) => Math.max(m, r.peak_viewers), 0);
	const streamCount = dailyRows.reduce((a, r) => a + r.stream_count, 0);
	const followersGain = dailyRows.reduce((a, r) => a + (r.followers_delta ?? 0), 0);
	const hasFollowerDelta = dailyRows.some((r) => r.followers_delta != null);

	return {
		platform: opts.platform,
		slug: channel.slug,
		display_name: channel.display_name,
		avatar_url: channel.avatar_url,
		language: channel.language,
		tracked_since: channel.first_observed_at,
		ingest_state: channel.ingest_state,
		follower_count: channel.follower_count,
		description: channel.description,
		period: opts.period,
		totals: {
			hours_watched: Math.round(sumHw),
			average_viewers: sumAirtimeMin > 0 ? Math.round((sumHw / (sumAirtimeMin / 60)) * 10) / 10 : 0,
			peak_viewers: peak,
			airtime_hours: Math.round((sumAirtimeMin / 60) * 10) / 10,
			stream_count: streamCount,
			followers_gain: hasFollowerDelta ? followersGain : null,
		},
		daily,
	};
}
