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

	it('returns empty when rankings empty and mock disabled', () => {
		expect(trendingFromRankings([])).toEqual([]);
	});

	it('falls back to static mock when rankings empty and mock enabled', () => {
		expect(trendingFromRankings([], { mockEnabled: true })).toEqual([...trendingSearches]);
	});

	it('scopes static fallback to requested platform when rollups empty', () => {
		const kickOnly = trendingFromRankings([], { platform: 'kick', mockEnabled: true });
		expect(kickOnly.every((t) => t.platform === 'kick')).toBe(true);
		expect(kickOnly.length).toBeGreaterThan(0);
	});

	it('returns empty demo fallback when platform has no mock entries', () => {
		expect(trendingFromRankings([], { platform: 'youtube', mockEnabled: true })).toEqual([]);
	});

	it('caps at five entries', () => {
		expect(trendingFromRankings(topChannels)).toHaveLength(5);
	});
});
