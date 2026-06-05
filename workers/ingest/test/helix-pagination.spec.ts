import { describe, it, expect } from 'vitest';
import { HELIX_MAX_CONSECUTIVE_EMPTY_PAGES, shouldContinueHelixPagination } from '../src/twitch/helix-pagination';

describe('shouldContinueHelixPagination', () => {
	it('stops when data is empty and there is no cursor', () => {
		expect(shouldContinueHelixPagination([], undefined, 0)).toBe(false);
	});

	it('continues on empty data when cursor is present', () => {
		expect(shouldContinueHelixPagination([], { cursor: 'next' }, 0)).toBe(true);
	});

	it('stops after max consecutive empty pages even with cursor', () => {
		expect(shouldContinueHelixPagination([], { cursor: 'next' }, HELIX_MAX_CONSECUTIVE_EMPTY_PAGES)).toBe(false);
	});

	it('continues when page has streams regardless of prior empty skips', () => {
		expect(shouldContinueHelixPagination([{ id: '1' }], { cursor: 'next' }, 2)).toBe(true);
	});
});
