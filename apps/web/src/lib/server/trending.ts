import { trendingSearches as fallbackTrendingSearches, type ChannelRow } from '$lib/mock/home';
import type { PlatformId } from '@omnicharts/domain';

export type TrendingSearch = {
	slug: string;
	name: string;
	platform: PlatformId;
};

/** Top-N channel rankings for search chips; mock fallback only when `mockEnabled`. */
export function trendingFromRankings(
	rows: ChannelRow[],
	options?: { platform?: PlatformId; mockEnabled?: boolean }
): TrendingSearch[] {
	if (!rows.length) {
		if (!options?.mockEnabled) return [];
		const platform = options?.platform;
		if (platform) {
			return fallbackTrendingSearches.filter((entry) => entry.platform === platform);
		}
		return [...fallbackTrendingSearches];
	}
	return rows.slice(0, 5).map((row) => ({
		slug: row.slug,
		name: row.displayName,
		platform: row.platform
	}));
}
