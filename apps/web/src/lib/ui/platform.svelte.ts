import {
	isRankingPeriod,
	isUiPlatformFilter,
	parseOptionalLanguageParam,
	PLATFORM_TWITCH,
	uiRankingPeriods,
	type PlatformId,
	type RankingPeriod,
	type UiPlatformFilter,
} from '@omnicharts/domain';

export type { PlatformId, RankingPeriod, UiPlatformFilter };

export type DataSource = 'live' | 'mock' | 'unavailable';

export const platforms: { id: UiPlatformFilter; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'twitch', label: 'Twitch' },
	{ id: 'kick', label: 'Kick' },
	{ id: 'youtube', label: 'YouTube' },
];

export const uiPeriods = uiRankingPeriods;

/** Active platform filter → ingest search `platform` param (Phase 2: `all` → Twitch data). */
export function searchPlatformId(platform: UiPlatformFilter): PlatformId {
	if (platform === 'kick' || platform === 'youtube') return platform;
	return PLATFORM_TWITCH;
}

export function parseUiPlatform(raw: string | null): UiPlatformFilter {
	const normalized = raw?.trim().toLowerCase() ?? '';
	if (normalized && isUiPlatformFilter(normalized)) return normalized;
	return PLATFORM_TWITCH;
}

export function platformLabel(platform: UiPlatformFilter): string {
	return platforms.find((p) => p.id === platform)?.label ?? 'Twitch';
}

export function platformQueryParam(platform: UiPlatformFilter): string {
	if (platform === 'kick' || platform === 'youtube' || platform === 'all') {
		return `&platform=${platform}`;
	}
	return '';
}

/** Append `?platform=` when non-default; optional extra query params. */
export function routeWithPlatform(path: string, platform: UiPlatformFilter, extra?: Record<string, string>): string {
	const q = new URLSearchParams(extra);
	if (platform === 'kick' || platform === 'youtube' || platform === 'all') {
		q.set('platform', platform);
	}
	const qs = q.toString();
	return qs ? `${path}?${qs}` : path;
}

export function parseUiPeriod(raw: string | null): { period: RankingPeriod; periodNote: string | null } {
	if (raw && isRankingPeriod(raw)) {
		return { period: raw, periodNote: null };
	}
	return { period: '7d', periodNote: null };
}

/** Common Helix/Kick stream language tags for rankings filter (Phase 4.7). */
export const rankingLanguages = [
	{ code: 'en', label: 'English' },
	{ code: 'es', label: 'Spanish' },
	{ code: 'fr', label: 'French' },
	{ code: 'de', label: 'German' },
	{ code: 'pt', label: 'Portuguese' },
	{ code: 'ru', label: 'Russian' },
	{ code: 'ja', label: 'Japanese' },
	{ code: 'ko', label: 'Korean' },
	{ code: 'zh', label: 'Chinese' },
] as const;

/** UI language filter — accepts any domain-valid BCP 47-lite tag; dropdown shows `rankingLanguages` subset. */
export function parseUiLanguage(raw: string | null): string | null {
	const parsed = parseOptionalLanguageParam(raw);
	if (!parsed.ok) return null;
	return parsed.language;
}

export function languageFilterNote(platform: UiPlatformFilter, language: string | null): string | null {
	if (!language) return null;
	const label = rankingLanguages.find((l) => l.code === language)?.label ?? language;
	if (platform === 'youtube') {
		return `${label} filter — YouTube channels rarely have language tags in our DB; results may be empty.`;
	}
	return `Showing ${label} streamers only (from platform language tags).`;
}

export function overviewPageSubtitle(platform: UiPlatformFilter, source: DataSource): string {
	const rollupPlatformName = platform === 'kick' ? 'Kick' : 'YouTube';
	if (platform === 'kick' || platform === 'youtube') {
		if (source === 'live') {
			return `${rollupPlatformName} rollup-backed counts when ingest has data.`;
		}
		if (source === 'mock') return 'Design preview stats (?demo=1).';
		return `${rollupPlatformName} ingest unavailable — start dev:ingest for rollup-backed overview.`;
	}
	if (source === 'live') return 'Twitch ingest health and rollup-backed counts.';
	if (source === 'mock') return 'Design preview stats (?demo=1).';
	return 'Ingest unavailable — start dev:ingest for live overview.';
}

export function searchPageSubtitle(platform: UiPlatformFilter): string {
	if (platform === 'all') {
		return 'Find Twitch streamers by name or slug while the All tab is selected (multi-platform search is planned).';
	}
	return `Find streamers by name or slug on ${platformLabel(platform)}.`;
}

export function channelsPageSubtitle(platform: UiPlatformFilter, source: DataSource): string {
	if (source === 'live') {
		if (platform === 'kick') return 'Top Kick channels by hours watched (ingest rollups).';
		if (platform === 'youtube') return 'Top YouTube channels by hours watched (ingest rollups).';
		return 'Top Twitch channels by hours watched (ingest rollups).';
	}
	if (source === 'mock') return 'Design preview — sample leaderboard (?demo=1).';
	if (source === 'unavailable') {
		return 'Ingest unavailable — start dev:ingest and run twitch:checkpoint for live rankings.';
	}
	return 'No rollups for this period yet.';
}

export function gamesPageSubtitle(platform: UiPlatformFilter, source: DataSource): string {
	if (source === 'live') {
		if (platform === 'kick') return 'Top Kick categories by average viewers (ingest rollups).';
		if (platform === 'youtube') return 'Top YouTube categories by average viewers (ingest rollups).';
		return 'Top Twitch categories by average viewers (ingest rollups).';
	}
	if (source === 'mock') return 'Design preview — sample leaderboard (?demo=1).';
	if (source === 'unavailable') {
		return 'Ingest unavailable — start dev:ingest and run twitch:checkpoint.';
	}
	return 'No game rollups for this period yet.';
}

export function homeRankingsFootnote(channelSource: DataSource, gameSource: DataSource): 'demo' | 'unavailable' | 'live' | null {
	if (channelSource === 'mock' || gameSource === 'mock') return 'demo';
	if (channelSource === 'unavailable' || gameSource === 'unavailable') return 'unavailable';
	if (channelSource === 'live' || gameSource === 'live') return 'live';
	return null;
}

export function channelRankingsEmptyMessage(hasRows: boolean, source: DataSource, period?: RankingPeriod): string | null {
	if (hasRows) return null;
	if (source === 'unavailable') return 'Channel rankings unavailable — ingest not reachable.';
	if (period === '90d') {
		return 'No channel rollups yet for the 90-day window — rankings fill in as daily ingest accumulates history.';
	}
	return 'No channel rollups yet for this period.';
}

export function gameRankingsEmptyMessage(hasRows: boolean, source: DataSource, period?: RankingPeriod): string | null {
	if (hasRows) return null;
	if (source === 'unavailable') return 'Game rankings unavailable — ingest not reachable.';
	if (period === '90d') {
		return 'No game rollups yet for the 90-day window — rankings fill in as daily ingest accumulates history.';
	}
	return 'No game rollups yet for this period.';
}

export function overviewTopGameLabel(platform: UiPlatformFilter): string {
	return platform === 'kick' ? 'category' : 'game';
}
