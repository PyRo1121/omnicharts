import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	RANKINGS_CACHE_TTL_MS,
	getCachedRankingsChannels,
	rankingsChannelsCacheKey,
	resetRankingsCacheForTests,
	setCachedRankingsChannels,
} from '../src/http/rankings-cache';

describe('rankings in-worker cache', () => {
	beforeEach(() => {
		resetRankingsCacheForTests();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns cached JSON until TTL expires', () => {
		const key = rankingsChannelsCacheKey({
			platform: 'twitch',
			period: '7d',
			limit: 20,
			minAverageViewers: 20,
			minAirtimeMinutes: 60,
		});
		setCachedRankingsChannels(key, '{"items":[]}');
		expect(getCachedRankingsChannels(key)).toBe('{"items":[]}');

		vi.advanceTimersByTime(RANKINGS_CACHE_TTL_MS - 1);
		expect(getCachedRankingsChannels(key)).toBe('{"items":[]}');

		vi.advanceTimersByTime(1);
		expect(getCachedRankingsChannels(key)).toBeNull();
	});

	it('isolates cache keys by query dimensions', () => {
		const base = {
			platform: 'twitch',
			period: '7d' as const,
			limit: 20,
			minAverageViewers: 20,
			minAirtimeMinutes: 60,
		};
		const keyA = rankingsChannelsCacheKey(base);
		const keyB = rankingsChannelsCacheKey({ ...base, period: '30d' });
		setCachedRankingsChannels(keyA, '{"period":"7d"}');
		expect(getCachedRankingsChannels(keyB)).toBeNull();
	});
});
