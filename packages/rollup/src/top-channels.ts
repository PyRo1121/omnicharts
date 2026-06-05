import { PLATFORM_TWITCH } from '@omnicharts/domain';
import type { D1Database } from './d1';
import { queryTopChannelsByHoursWatched, type ChannelRollupQueryRow } from './ranking-queries';
import { sortChannelsByHoursWatched } from './sort';

export type TopChannelRanking = {
	rank: number;
	slug: string;
	displayName: string;
	avatarUrl: string | null;
	hoursWatched: number;
	averageViewers: number;
	peakViewers: number;
	airtimeHours: number;
	streamCount: number;
	trackedSince: string | null;
};

export function rankTopChannelsFromRollupRows(rows: ChannelRollupQueryRow[], limit: number): TopChannelRanking[] {
	const bySlug = new Map(rows.map((r) => [r.slug, r]));
	const sorted = sortChannelsByHoursWatched(
		rows.map((r) => ({
			slug: r.slug,
			displayName: r.display_name,
			hoursWatched: r.hours_watched,
			averageViewers: r.average_viewers,
		})),
	).slice(0, limit);

	return sorted.map((r, i) => {
		const row = bySlug.get(r.slug);
		const airtimeMinutes = row?.airtime_minutes ?? 0;
		return {
			rank: i + 1,
			slug: r.slug,
			displayName: r.displayName,
			avatarUrl: row?.avatar_url ?? null,
			hoursWatched: r.hoursWatched,
			averageViewers: r.averageViewers,
			peakViewers: row?.peak_viewers ?? 0,
			airtimeHours: Math.round((airtimeMinutes / 60) * 10) / 10,
			streamCount: row?.stream_count ?? 0,
			trackedSince: row?.first_observed_at ?? null,
		};
	});
}

export async function getTopChannelsByHoursWatched(
	db: D1Database,
	opts: {
		platformId: string;
		days?: number;
		limit?: number;
		minAverageViewers?: number;
		minAirtimeMinutes?: number;
		language?: string | null;
	},
): Promise<TopChannelRanking[]> {
	const days = opts.days ?? 7;
	const limit = Math.min(opts.limit ?? 20, 100);

	const rows = await queryTopChannelsByHoursWatched(db, {
		platformId: opts.platformId,
		days,
		limit,
		minAirtimeMinutes: opts.minAirtimeMinutes,
		minAverageViewers: opts.minAverageViewers ?? 0,
		language: opts.language ?? null,
	});

	return rankTopChannelsFromRollupRows(rows, limit);
}

/** @deprecated Prefer {@link getTopChannelsByHoursWatched} with `platformId: 'twitch'`. */
export async function getTopTwitchChannelsByHoursWatched(
	db: D1Database,
	opts: {
		days?: number;
		limit?: number;
		minAverageViewers?: number;
		minAirtimeMinutes?: number;
	} = {},
): Promise<TopChannelRanking[]> {
	return getTopChannelsByHoursWatched(db, { ...opts, platformId: PLATFORM_TWITCH });
}
