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

/** Top-N channel rankings for search chips; static mock when ingest has no rollups yet. */
export function trendingFromRankings(rows: ChannelRow[]): TrendingSearch[] {
	if (!rows.length) return [...fallbackTrendingSearches];
	return rows.slice(0, 5).map((row) => ({
		slug: row.slug,
		name: row.displayName,
		platform: row.platform
	}));
}
