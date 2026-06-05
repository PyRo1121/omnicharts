export type PlatformId = 'all' | 'twitch' | 'kick' | 'youtube';

export type ChannelRow = {
	rank: number;
	slug: string;
	displayName: string;
	platform: Exclude<PlatformId, 'all'>;
	avatarUrl: string;
	metric: string;
	metricLabel: string;
};

export type GameRow = {
	rank: number;
	slug: string;
	name: string;
	platform: Exclude<PlatformId, 'all'>;
	boxArtUrl: string;
	metric: string;
	metricLabel: string;
};

/** Active platform filter → ingest search `platform` param (Phase 2: `all` → Twitch data). */
export function searchPlatformId(platform: PlatformId): Exclude<PlatformId, 'all'> {
	if (platform === 'kick' || platform === 'youtube') return platform;
	return 'twitch';
}

export function parseUiPlatform(raw: string | null): PlatformId {
	if (raw && platforms.some((p) => p.id === raw)) return raw as PlatformId;
	return 'twitch';
}

export function platformQueryParam(platform: PlatformId): string {
	if (platform === 'kick' || platform === 'youtube' || platform === 'all') {
		return `&platform=${platform}`;
	}
	return '';
}

export const platforms: { id: PlatformId; label: string }[] = [
	{ id: 'all', label: 'All platforms' },
	{ id: 'twitch', label: 'Twitch' },
	{ id: 'kick', label: 'Kick' },
	{ id: 'youtube', label: 'YouTube' }
];

export const periods = ['24h', '7d', '30d', '90d'] as const;
export type Period = (typeof periods)[number];

/** Shown in period selectors until Phase 4 retention (REM-022). */
export const uiPeriods = ['24h', '7d', '30d'] as const satisfies readonly Period[];

export function parseUiPeriod(raw: string | null): { period: Period; periodNote: string | null } {
	if (raw === '90d') {
		return {
			period: '30d',
			periodNote: '90-day retention is not available yet — showing 30 days.'
		};
	}
	if (raw && (uiPeriods as readonly string[]).includes(raw)) {
		return { period: raw as Period, periodNote: null };
	}
	return { period: '7d', periodNote: null };
}

export const heroStats = [
	{ label: 'Channels tracked', value: '2.4M+', hint: 'Growing with ingest' },
	{ label: 'Platforms', value: '3', hint: 'Twitch · Kick · YouTube' },
	{ label: 'Sample cadence', value: '1m', hint: 'Live directory sweep' }
];

export const topChannels: ChannelRow[] = [
	{
		rank: 1,
		slug: 'caedrel',
		displayName: 'Caedrel',
		platform: 'twitch',
		avatarUrl:
			'https://static-cdn.jtvnw.net/jtv_user_pictures/483a37ac-58fd-4e2f-8dc3-2c68a0164112-profile_image-50x50.png',
		metric: '2.17M',
		metricLabel: 'Hours watched'
	},
	{
		rank: 2,
		slug: 'korekore_ch',
		displayName: 'korekore_ch',
		platform: 'kick',
		avatarUrl:
			'https://files.kick.com/images/user/58166499/profile_image/conversion/e0edc160-d87e-40aa-b0e6-555b08583d3e-thumb.webp',
		metric: '1.72M',
		metricLabel: 'Hours watched'
	},
	{
		rank: 3,
		slug: 'ramzes',
		displayName: 'ramzes',
		platform: 'twitch',
		avatarUrl:
			'https://static-cdn.jtvnw.net/jtv_user_pictures/c44ea060-3b8c-4606-b8a9-d7cb788a54da-profile_image-50x50.png',
		metric: '1.71M',
		metricLabel: 'Hours watched'
	},
	{
		rank: 4,
		slug: 'mazellovvv',
		displayName: 'mazellovvv',
		platform: 'twitch',
		avatarUrl:
			'https://static-cdn.jtvnw.net/jtv_user_pictures/29d2767f-443b-48cc-b689-d3a863972c4d-profile_image-50x50.png',
		metric: '1.69M',
		metricLabel: 'Hours watched'
	},
	{
		rank: 5,
		slug: 'kato_junichi0817',
		displayName: '加藤純一うん〇ちゃん',
		platform: 'twitch',
		avatarUrl:
			'https://static-cdn.jtvnw.net/jtv_user_pictures/a4977cfd-1962-41ec-9355-ab2611b97552-profile_image-50x50.png',
		metric: '1.67M',
		metricLabel: 'Hours watched'
	}
];

export const topGames: GameRow[] = [
	{
		rank: 1,
		slug: 'just-chatting',
		name: 'Just Chatting',
		platform: 'twitch',
		boxArtUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-40x56.jpg',
		metric: '339K',
		metricLabel: 'Avg viewers'
	},
	{
		rank: 2,
		slug: 'just-chatting',
		name: 'Just Chatting',
		platform: 'kick',
		boxArtUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-40x56.jpg',
		metric: '113K',
		metricLabel: 'Avg viewers'
	},
	{
		rank: 3,
		slug: 'league-of-legends',
		name: 'League of Legends',
		platform: 'twitch',
		boxArtUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/21779-40x56.jpg',
		metric: '113K',
		metricLabel: 'Avg viewers'
	},
	{
		rank: 4,
		slug: 'counter-strike',
		name: 'Counter-Strike',
		platform: 'twitch',
		boxArtUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/32399-40x56.jpg',
		metric: '94K',
		metricLabel: 'Avg viewers'
	},
	{
		rank: 5,
		slug: 'valorant',
		name: 'Valorant',
		platform: 'twitch',
		boxArtUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-40x56.jpg',
		metric: '80K',
		metricLabel: 'Avg viewers'
	}
];

export const trendingSearches = [
	{ slug: 'jynxzi', name: 'Jynxzi', platform: 'twitch' as const },
	{ slug: 'caseoh_', name: 'caseoh_', platform: 'twitch' as const },
	{ slug: 'sxb', name: 'sxb', platform: 'kick' as const }
];
