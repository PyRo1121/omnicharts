import { parseRankingPeriod } from '@omnicharts/domain';
import {
	buildGameDetailResponse,
	formatHoursWatched,
	type GameTopChannelItem
} from '@omnicharts/rollup';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { periodForApi } from '$lib/server/period-api';
import type { ChannelDailyPoint } from '$lib/server/channel';
import type { ServerLoadContext } from '$lib/server/load-context';
import { webRankingEligibility } from '$lib/server/ranking-env';
import { parseUiPeriod, type Period } from '$lib/ui/platform.svelte';

export type GameTopChannelRow = {
	rank: number;
	slug: string;
	displayName: string;
	avatarUrl: string;
	hoursWatched: string;
};

export type GameDetailLoad = {
	source: 'live' | 'not_found' | 'error';
	platform: string;
	period: Period;
	slug: string;
	name: string;
	daily: ChannelDailyPoint[];
	topChannels: GameTopChannelRow[];
	totals: {
		hoursWatched: number;
		averageViewers: number;
		peakViewers: number;
		airtimeHours: number;
		liveChannels: number;
	};
};

type IngestGameDaily = {
	date: string;
	hours_watched: number;
	average_viewers: number;
	peak_viewers: number;
};

type IngestGameResponse = {
	platform: string;
	slug: string;
	name: string;
	period: string;
	totals: {
		hours_watched: number;
		average_viewers: number;
		peak_viewers: number;
		airtime_hours: number;
		live_channels: number;
	};
	daily?: IngestGameDaily[];
	top_channels?: GameTopChannelItem[];
};

export function parseGamePeriod(raw: string | null): { period: Period; periodNote: string | null } {
	return parseUiPeriod(raw);
}

function mapDaily(rows: IngestGameDaily[] | undefined): ChannelDailyPoint[] {
	if (!rows?.length) return [];
	return rows.map((d) => ({
		date: d.date,
		hoursWatched: d.hours_watched,
		averageViewers: d.average_viewers,
		peakViewers: d.peak_viewers
	}));
}

function mapTopChannels(rows: GameTopChannelItem[] | undefined): GameTopChannelRow[] {
	if (!rows?.length) return [];
	return rows.map((row) => ({
		rank: row.rank,
		slug: row.slug,
		displayName: row.display_name,
		avatarUrl: row.avatar_url ?? '',
		hoursWatched: formatHoursWatched(row.hours_watched)
	}));
}

function mapGameBody(body: IngestGameResponse, period: Period): GameDetailLoad {
	return {
		source: 'live',
		platform: body.platform,
		period,
		slug: body.slug,
		name: body.name,
		daily: mapDaily(body.daily),
		topChannels: mapTopChannels(body.top_channels),
		totals: {
			hoursWatched: body.totals.hours_watched,
			averageViewers: body.totals.average_viewers,
			peakViewers: body.totals.peak_viewers,
			airtimeHours: body.totals.airtime_hours,
			liveChannels: body.totals.live_channels
		}
	};
}

function emptyGameLoad(
	source: 'not_found' | 'error',
	slug: string,
	platform: string,
	period: Period
): GameDetailLoad {
	return {
		source,
		platform,
		period,
		slug,
		name: slug,
		daily: [],
		topChannels: [],
		totals: {
			hoursWatched: 0,
			averageViewers: 0,
			peakViewers: 0,
			airtimeHours: 0,
			liveChannels: 0
		}
	};
}

export async function loadGameDetail(
	ctx: ServerLoadContext,
	slug: string,
	platform: string,
	period: Period
): Promise<GameDetailLoad> {
	const apiPeriod = parseRankingPeriod(periodForApi(period));

	try {
		if (ctx.db && (platform === 'twitch' || platform === 'kick' || platform === 'youtube')) {
			try {
				const eligibility = webRankingEligibility(ctx.cfEnv, platform);
				const body = await buildGameDetailResponse(
					ctx.db,
					{ platform, slug, period: apiPeriod },
					{
						minAirtimeMinutes: eligibility.minAirtimeMinutes,
						minAverageViewers: eligibility.minAverageViewers
					}
				);
				if (!body) return emptyGameLoad('not_found', slug, platform, period);
				return mapGameBody(body as IngestGameResponse, period);
			} catch {
				/* platformProxy D1 may be empty — fall through to ingest HTTP */
			}
		}

		const url = `${getIngestBaseUrl()}/v1/games/${encodeURIComponent(slug)}?platform=${encodeURIComponent(platform)}&period=${periodForApi(period)}`;
		const res = await ctx.fetch(url, { headers: { accept: 'application/json' } });
		if (res.status === 404) return emptyGameLoad('not_found', slug, platform, period);
		if (!res.ok) throw new Error(`ingest ${res.status}`);
		const body = (await res.json()) as IngestGameResponse;
		return mapGameBody(body, period);
	} catch {
		return emptyGameLoad('error', slug, platform, period);
	}
}
