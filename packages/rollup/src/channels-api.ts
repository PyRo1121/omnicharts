import type { D1Database } from './d1';
import {
	PLATFORM_TWITCH,
	isPlatformId,
	isRankingPeriod,
	parseOptionalLanguageParam,
	parseRankingPeriod,
	periodToDays,
	type RankingPeriod,
} from '@omnicharts/domain';
import { MIN_RANKING_AIRTIME_MINUTES } from './eligibility';
import { rankingQueryOptionsForPlatform, type RankingEligibilityEnv } from './ranking-env';
import { getTopChannelsByHoursWatched } from './top-channels';

export type RankingsChannelsItem = {
	rank: number;
	slug: string;
	display_name: string;
	avatar_url: string | null;
	hours_watched: number;
	average_viewers: number;
	peak_viewers: number | null;
	airtime_hours: number | null;
	stream_count: number;
	tracked_since: string | null;
};

export type RankingsChannelsResponse = {
	platform: string;
	period: RankingPeriod;
	language?: string;
	updated_at: string;
	items: RankingsChannelsItem[];
};

export type RankingsBaseQueryError = 'invalid_period' | 'invalid_limit' | 'invalid_platform';
export type RankingsQueryError = RankingsBaseQueryError | 'invalid_language';

export type ParsedRankingsChannelsQuery =
	| { ok: true; platform: string; period: RankingPeriod; limit: number; language: string | null }
	| { ok: false; error: RankingsQueryError };

export function parseRankingsChannelsQuery(url: URL): ParsedRankingsChannelsQuery {
	const platformRaw = url.searchParams.get('platform') ?? PLATFORM_TWITCH;
	if (!isPlatformId(platformRaw)) {
		return { ok: false, error: 'invalid_platform' };
	}
	const platform = platformRaw;
	const periodRaw = url.searchParams.get('period');
	if (periodRaw != null && periodRaw !== '' && !isRankingPeriod(periodRaw)) {
		return { ok: false, error: 'invalid_period' };
	}
	const period = parseRankingPeriod(periodRaw);
	const languageParsed = parseOptionalLanguageParam(url.searchParams.get('language'));
	if (!languageParsed.ok) {
		return { ok: false, error: languageParsed.error };
	}
	const limitRaw = url.searchParams.get('limit') ?? '20';
	const limitNum = Number(limitRaw);
	if (Number.isNaN(limitNum) || limitNum < 1) {
		return { ok: false, error: 'invalid_limit' };
	}
	const limit = Math.min(100, Math.max(1, Math.floor(limitNum)));
	return { ok: true, platform, period, limit, language: languageParsed.language };
}

export async function buildRankingsChannelsResponse(
	db: D1Database,
	opts: {
		platform: string;
		period: RankingPeriod;
		limit: number;
		language?: string | null;
		minAverageViewers?: number;
		minAirtimeMinutes?: number;
	},
	env?: RankingEligibilityEnv,
): Promise<RankingsChannelsResponse> {
	const days = periodToDays(opts.period);
	const language = opts.language ?? null;
	const eligibility = env
		? rankingQueryOptionsForPlatform(env, opts.platform)
		: {
				minAirtimeMinutes: opts.minAirtimeMinutes ?? MIN_RANKING_AIRTIME_MINUTES,
				minAverageViewers: opts.minAverageViewers ?? 0,
			};
	const rankings = await getTopChannelsByHoursWatched(db, {
		platformId: opts.platform,
		days,
		limit: opts.limit,
		minAverageViewers: eligibility.minAverageViewers,
		minAirtimeMinutes: eligibility.minAirtimeMinutes,
		language,
	});

	return {
		platform: opts.platform,
		period: opts.period,
		...(language ? { language } : {}),
		updated_at: new Date().toISOString(),
		items: rankings.map((r) => ({
			rank: r.rank,
			slug: r.slug,
			display_name: r.displayName,
			avatar_url: r.avatarUrl,
			hours_watched: Math.round(r.hoursWatched),
			average_viewers: Math.round(r.averageViewers),
			peak_viewers: r.peakViewers,
			airtime_hours: r.airtimeHours,
			stream_count: r.streamCount,
			tracked_since: r.trackedSince,
		})),
	};
}
