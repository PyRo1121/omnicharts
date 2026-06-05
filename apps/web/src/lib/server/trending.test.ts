import { describe, it, expect } from 'vitest';
import { trendingFromRankings } from './trending';
import { trendingSearches, topChannels } from '$lib/mock/home';

describe('trendingFromRankings', () => {
	it('maps ranking rows to trending chips', () => {
		const rows = topChannels.slice(0, 3);
		expect(trendingFromRankings(rows)).toEqual([
			{ slug: 'caedrel', name: 'Caedrel', platform: 'twitch' },
			{ slug: 'korekore_ch', name: 'korekore_ch', platform: 'kick' },
			{ slug: 'ramzes', name: 'ramzes', platform: 'twitch' }
		]);
	});

	it('falls back to static mock when rankings empty', () => {
		expect(trendingFromRankings([])).toEqual([...trendingSearches]);
	});

	it('caps at five entries', () => {
		expect(trendingFromRankings(topChannels)).toHaveLength(5);
	});
});
