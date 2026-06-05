import { parseOptionalLanguageParam } from '@omnicharts/domain';

export type PlatformId = 'all' | 'twitch' | 'kick' | 'youtube';

export type DataSource = 'live' | 'mock' | 'unavailable';

export const platforms: { id: PlatformId; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'twitch', label: 'Twitch' },
	{ id: 'kick', label: 'Kick' },
	{ id: 'youtube', label: 'YouTube' }
];

export const periods = ['24h', '7d', '30d', '90d'] as const;
export type Period = (typeof periods)[number];

/** Shown in period selectors — Phase 4 adds `90d`. */
export const uiPeriods = ['24h', '7d', '30d', '90d'] as const satisfies readonly Period[];

/** Active platform filter → ingest search `platform` param (Phase 2: `all` → Twitch data). */
export function searchPlatformId(platform: PlatformId): Exclude<PlatformId, 'all'> {
	if (platform === 'kick' || platform === 'youtube') return platform;
	return 'twitch';
}

export function parseUiPlatform(raw: string | null): PlatformId {
	const normalized = raw?.trim().toLowerCase() ?? '';
	if (normalized && platforms.some((p) => p.id === normalized)) return normalized as PlatformId;
	return 'twitch';
}

export function platformLabel(platform: PlatformId): string {
	return platforms.find((p) => p.id === platform)?.label ?? 'Twitch';
}

export function platformQueryParam(platform: PlatformId): string {
	if (platform === 'kick' || platform === 'youtube' || platform === 'all') {
		return `&platform=${platform}`;
	}
	return '';
}

/** Append `?platform=` when non-default; optional extra query params. */
export function routeWithPlatform(
	path: string,
	platform: PlatformId,
	extra?: Record<string, string>
): string {
	const q = new URLSearchParams(extra);
	if (platform === 'kick' || platform === 'youtube' || platform === 'all') {
		q.set('platform', platform);
	}
	const qs = q.toString();
	return qs ? `${path}?${qs}` : path;
}

export function parseUiPeriod(raw: string | null): { period: Period; periodNote: string | null } {
	if (raw && (periods as readonly string[]).includes(raw)) {
		return { period: raw as Period, periodNote: null };
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
	{ code: 'zh', label: 'Chinese' }
] as const;

/** UI language filter — accepts any domain-valid BCP 47-lite tag; dropdown shows `rankingLanguages` subset. */
export function parseUiLanguage(raw: string | null): string | null {
	const parsed = parseOptionalLanguageParam(raw);
	if (!parsed.ok) return null;
	return parsed.language;
}

export function languageFilterNote(platform: PlatformId, language: string | null): string | null {
	if (!language) return null;
	const label = rankingLanguages.find((l) => l.code === language)?.label ?? language;
	if (platform === 'youtube') {
		return `${label} filter — YouTube channels rarely have language tags in our DB; results may be empty.`;
	}
	return `Showing ${label} streamers only (from platform language tags).`;
}

export function overviewPageSubtitle(platform: PlatformId, source: DataSource): string {
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

export function searchPageSubtitle(platform: PlatformId): string {
	if (platform === 'all') {
		return 'Find streamers by name or slug across Twitch, Kick, and YouTube.';
	}
	return `Find streamers by name or slug on ${platformLabel(platform)}.`;
}

export function channelsPageSubtitle(platform: PlatformId, source: DataSource): string {
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

export function gamesPageSubtitle(platform: PlatformId, source: DataSource): string {
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

export function phase3UnsupportedMessage(platform: PlatformId): string {
	const name = platform === 'kick' ? 'Kick' : 'YouTube';
	return `${name} rankings ship in Phase 3. Switch to Twitch for live leaderboards.`;
}

export function homeRankingsFootnote(
	channelSource: DataSource,
	gameSource: DataSource
): 'demo' | 'unavailable' | 'live' | null {
	if (channelSource === 'mock' || gameSource === 'mock') return 'demo';
	if (channelSource === 'unavailable' || gameSource === 'unavailable') return 'unavailable';
	if (channelSource === 'live' || gameSource === 'live') return 'live';
	return null;
}

export function channelRankingsEmptyMessage(
	platformUnsupported: boolean,
	platform: PlatformId,
	hasRows: boolean,
	source: DataSource,
	period?: Period
): string | null {
	if (platformUnsupported) return phase3UnsupportedMessage(platform);
	if (hasRows) return null;
	if (source === 'unavailable') return 'Channel rankings unavailable — ingest not reachable.';
	if (period === '90d') {
		return 'No channel rollups yet for the 90-day window — rankings fill in as daily ingest accumulates history.';
	}
	return 'No channel rollups yet for this period.';
}

export function gameRankingsEmptyMessage(
	platformUnsupported: boolean,
	platform: PlatformId,
	hasRows: boolean,
	source: DataSource,
	period?: Period
): string | null {
	if (platformUnsupported) return phase3UnsupportedMessage(platform);
	if (hasRows) return null;
	if (source === 'unavailable') return 'Game rankings unavailable — ingest not reachable.';
	if (period === '90d') {
		return 'No game rollups yet for the 90-day window — rankings fill in as daily ingest accumulates history.';
	}
	return 'No game rollups yet for this period.';
}

export function overviewTopGameLabel(platform: PlatformId): string {
	return platform === 'kick' ? 'category' : 'game';
}
