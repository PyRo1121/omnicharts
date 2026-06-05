import { parseRankingPeriod } from '@omnicharts/domain';
import {
	buildChannelDetailResponse,
	resolveChannelSlug
} from '@omnicharts/rollup';
import { getIngestBaseUrl } from '$lib/server/ingest';
import type { ServerLoadContext } from '$lib/server/load-context';
import { parseUiPeriod, type Period } from '$lib/ui/platform.svelte';

export type ChannelDailyPoint = {
	date: string;
	hoursWatched: number;
	averageViewers: number;
	peakViewers: number;
};

export type ChannelDetailLoad = {
	source: 'live' | 'not_found' | 'error';
	platform: string;
	period: Period;
	slug: string;
	displayName: string;
	avatarUrl: string | null;
	language: string | null;
	followerCount: number | null;
	description: string | null;
	trackedSince: string | null;
	ingestState: string;
	daily: ChannelDailyPoint[];
	totals: {
		hoursWatched: number;
		averageViewers: number;
		peakViewers: number;
		airtimeHours: number;
		streamCount: number;
		followersGain: number | null;
	};
};

type IngestChannelResponse = {
	platform: string;
	slug: string;
	display_name: string;
	avatar_url: string | null;
	tracked_since: string | null;
	ingest_state: string;
	follower_count: number | null;
	description: string | null;
	language?: string | null;
	period: string;
	totals: {
		hours_watched: number;
		average_viewers: number;
		peak_viewers: number;
		airtime_hours: number;
		stream_count: number;
		followers_gain: number | null;
	};
	daily?: {
		date: string;
		hours_watched: number;
		average_viewers: number;
		peak_viewers: number;
		airtime_hours?: number;
		stream_count?: number;
	}[];
};

function mapDaily(
	rows: IngestChannelResponse['daily'] | undefined
): ChannelDailyPoint[] {
	if (!rows?.length) return [];
	return rows.map((d) => ({
		date: d.date,
		hoursWatched: d.hours_watched,
		averageViewers: d.average_viewers,
		peakViewers: d.peak_viewers
	}));
}

function mapChannelBody(body: IngestChannelResponse, period: Period): ChannelDetailLoad {
	return {
		source: 'live',
		platform: body.platform,
		period,
		slug: body.slug,
		displayName: body.display_name,
		avatarUrl: body.avatar_url,
		language: body.language ?? null,
		followerCount: body.follower_count,
		description: body.description,
		trackedSince: body.tracked_since,
		ingestState: body.ingest_state,
		daily: mapDaily(body.daily),
		totals: {
			hoursWatched: body.totals.hours_watched,
			averageViewers: body.totals.average_viewers,
			peakViewers: body.totals.peak_viewers,
			airtimeHours: body.totals.airtime_hours,
			streamCount: body.totals.stream_count,
			followersGain: body.totals.followers_gain
		}
	};
}

function notFoundLoad(
	slug: string,
	platform: string,
	period: Period
): ChannelDetailLoad {
	return {
		source: 'not_found',
		platform,
		period,
		slug,
		displayName: slug,
		avatarUrl: null,
		language: null,
		followerCount: null,
		description: null,
		trackedSince: null,
		ingestState: 'unknown',
		daily: [],
		totals: {
			hoursWatched: 0,
			averageViewers: 0,
			peakViewers: 0,
			airtimeHours: 0,
			streamCount: 0,
			followersGain: null
		}
	};
}

function errorLoad(slug: string, platform: string, period: Period): ChannelDetailLoad {
	return {
		source: 'error',
		platform,
		period,
		slug,
		displayName: slug,
		avatarUrl: null,
		language: null,
		followerCount: null,
		description: null,
		trackedSince: null,
		ingestState: 'unknown',
		daily: [],
		totals: {
			hoursWatched: 0,
			averageViewers: 0,
			peakViewers: 0,
			airtimeHours: 0,
			streamCount: 0,
			followersGain: null
		}
	};
}

export function parseChannelPeriod(raw: string | null): { period: Period; periodNote: string | null } {
	return parseUiPeriod(raw);
}

export type ChannelPlatformSuggestion = {
	slug: string;
	platform: string;
	displayName: string;
};

const CHANNEL_LOOKUP_PLATFORMS = ['twitch', 'kick', 'youtube'] as const;

export async function findChannelOnOtherPlatforms(
	ctx: ServerLoadContext,
	slug: string,
	currentPlatform: string
): Promise<ChannelPlatformSuggestion[]> {
	const others = CHANNEL_LOOKUP_PLATFORMS.filter((platform) => platform !== currentPlatform);
	const matches = await Promise.all(
		others.map(async (platform) => {
			try {
				const url = `${getIngestBaseUrl()}/v1/channels/${encodeURIComponent(slug)}?platform=${encodeURIComponent(platform)}&period=7d`;
				const res = await ctx.fetch(url, { headers: { accept: 'application/json' } });
				if (!res.ok) return null;
				const body = (await res.json()) as {
					slug: string;
					display_name: string;
					platform?: string;
				};
				return {
					slug: body.slug,
					platform: body.platform ?? platform,
					displayName: body.display_name
				};
			} catch {
				return null;
			}
		})
	);
	return matches.filter((row): row is ChannelPlatformSuggestion => row != null);
}

export async function resolveChannelSlugFromHistory(
	ctx: ServerLoadContext,
	slug: string,
	platform: string
): Promise<string | null> {
	if (ctx.db && (platform === 'twitch' || platform === 'kick' || platform === 'youtube')) {
		try {
			const resolved = await resolveChannelSlug(ctx.db, { platform, slug });
			if (resolved?.from_history && resolved.slug !== slug) return resolved.slug;
			return null;
		} catch {
			/* platformProxy D1 may be empty — fall through to ingest HTTP */
		}
	}

	const params = new URLSearchParams({ slug, platform });
	try {
		const res = await ctx.fetch(`${getIngestBaseUrl()}/v1/channels/resolve?${params}`, {
			headers: { accept: 'application/json' }
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { slug: string; from_history?: boolean };
		if (body.from_history && body.slug && body.slug !== slug) return body.slug;
		return null;
	} catch {
		return null;
	}
}

function periodForApi(period: Period): string {
	if (period === '24h' || period === '7d' || period === '30d' || period === '90d') return period;
	return '7d';
}

export async function loadChannelDetail(
	ctx: ServerLoadContext,
	slug: string,
	platform: string,
	period: Period
): Promise<ChannelDetailLoad> {
	const apiPeriod = parseRankingPeriod(periodForApi(period));

	try {
		if (ctx.db && (platform === 'twitch' || platform === 'kick' || platform === 'youtube')) {
			try {
				const body = await buildChannelDetailResponse(ctx.db, {
					platform,
					slug,
					period: apiPeriod
				});
				if (body) return mapChannelBody(body as IngestChannelResponse, period);
			} catch {
				/* platformProxy D1 may be empty — fall through to ingest HTTP */
			}
		}

		const url = `${getIngestBaseUrl()}/v1/channels/${encodeURIComponent(slug)}?platform=${encodeURIComponent(platform)}&period=${periodForApi(period)}`;
		const res = await ctx.fetch(url, { headers: { accept: 'application/json' } });
		if (res.status === 404) return notFoundLoad(slug, platform, period);
		if (!res.ok) throw new Error(`ingest ${res.status}`);
		const body = (await res.json()) as IngestChannelResponse;
		return mapChannelBody(body, period);
	} catch {
		return errorLoad(slug, platform, period);
	}
}
