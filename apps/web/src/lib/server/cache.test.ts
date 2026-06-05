import { describe, it, expect, vi } from 'vitest';
import {
	ROLLUP_CACHE_CONTROL,
	SEARCH_CACHE_CONTROL,
	applyRollupPageCache,
	applySearchPageCache
} from './cache';

describe('page cache headers', () => {
	it('applyRollupPageCache sets public 60s rollup cache', () => {
		const setHeaders = vi.fn();
		applyRollupPageCache(setHeaders);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': ROLLUP_CACHE_CONTROL });
		expect(ROLLUP_CACHE_CONTROL).toBe('public, max-age=60');
	});

	it('applySearchPageCache sets private 30s search cache', () => {
		const setHeaders = vi.fn();
		applySearchPageCache(setHeaders);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': SEARCH_CACHE_CONTROL });
		expect(SEARCH_CACHE_CONTROL).toBe('private, max-age=30');
	});
});
