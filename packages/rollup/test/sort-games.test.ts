import { describe, it, expect } from 'bun:test';
import { sortGamesByAverageViewers } from '../src/sort';

describe('sortGamesByAverageViewers (docs/04)', () => {
	it('sorts by average viewers descending', () => {
		const sorted = sortGamesByAverageViewers([
			{ slug: 'b', averageViewers: 10, hoursWatched: 100 },
			{ slug: 'a', averageViewers: 50, hoursWatched: 10 }
		]);
		expect(sorted[0].slug).toBe('a');
	});

	it('tie-break: higher hours watched wins', () => {
		const sorted = sortGamesByAverageViewers([
			{ slug: 'low-hw', averageViewers: 20, hoursWatched: 10 },
			{ slug: 'high-hw', averageViewers: 20, hoursWatched: 50 }
		]);
		expect(sorted[0].slug).toBe('high-hw');
	});

	it('tie-break: slug ascending', () => {
		const sorted = sortGamesByAverageViewers([
			{ slug: 'zebra', averageViewers: 20, hoursWatched: 10 },
			{ slug: 'alpha', averageViewers: 20, hoursWatched: 10 }
		]);
		expect(sorted[0].slug).toBe('alpha');
	});
});
