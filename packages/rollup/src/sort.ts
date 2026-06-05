export type RankedChannelRow = {
	slug: string;
	displayName: string;
	hoursWatched: number;
	averageViewers: number;
};

/** docs/13-testing-and-verification.md tie-break rules */
export function sortChannelsByHoursWatched<T extends RankedChannelRow>(rows: T[]): T[] {
	return [...rows].sort((a, b) => {
		if (b.hoursWatched !== a.hoursWatched) return b.hoursWatched - a.hoursWatched;
		if (b.averageViewers !== a.averageViewers) return b.averageViewers - a.averageViewers;
		return a.slug.localeCompare(b.slug);
	});
}
