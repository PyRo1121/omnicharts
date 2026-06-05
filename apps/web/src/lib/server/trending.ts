import {
	trendingSearches as fallbackTrendingSearches,
	type ChannelRow,
	type PlatformId
} from '$lib/mock/home';

export type TrendingSearch = {
	slug: string;
	name: string;
	platform: Exclude<PlatformId, 'all'>;
};

/** Top-N channel rankings for search chips; mock fallback only when `mockEnabled`. */
export function trendingFromRankings(
	rows: ChannelRow[],
	options?: { platform?: Exclude<PlatformId, 'all'>; mockEnabled?: boolean }
): TrendingSearch[] {
	if (!rows.length) {
		if (!options?.mockEnabled) return [];
		const platform = options?.platform;
		const scoped = platform
			? fallbackTrendingSearches.filter((entry) => entry.platform === platform)
			: [...fallbackTrendingSearches];
		return scoped.length > 0 ? scoped : [...fallbackTrendingSearches];
	}
	return rows.slice(0, 5).map((row) => ({
		slug: row.slug,
		name: row.displayName,
		platform: row.platform
	}));
}
