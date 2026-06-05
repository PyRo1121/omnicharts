import { describe, it, expect } from 'vitest';
import { sortChannelsByHoursWatched } from '../src/ranking/sort';

describe('ranking sort (docs/13-testing-and-verification.md)', () => {
	it('sorts by hours watched descending', () => {
		const rows = [
			{ slug: 'b', displayName: 'B', hoursWatched: 10, averageViewers: 5 },
			{ slug: 'a', displayName: 'A', hoursWatched: 100, averageViewers: 1 }
		];
		const sorted = sortChannelsByHoursWatched(rows);
		expect(sorted[0].slug).toBe('a');
	});

	it('tie-break: higher average viewers wins', () => {
		const rows = [
			{ slug: 'low-av', displayName: 'L', hoursWatched: 50, averageViewers: 10 },
			{ slug: 'high-av', displayName: 'H', hoursWatched: 50, averageViewers: 20 }
		];
		const sorted = sortChannelsByHoursWatched(rows);
		expect(sorted[0].slug).toBe('high-av');
	});

	it('tie-break: lexicographic slug asc', () => {
		const rows = [
			{ slug: 'zebra', displayName: 'Z', hoursWatched: 50, averageViewers: 10 },
			{ slug: 'alpha', displayName: 'A', hoursWatched: 50, averageViewers: 10 }
		];
		const sorted = sortChannelsByHoursWatched(rows);
		expect(sorted[0].slug).toBe('alpha');
	});
});
