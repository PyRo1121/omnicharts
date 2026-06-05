/** Helix dynamic-list pagination — ADR-0006, Twitch API guide § Pagination */

/** Max consecutive empty `data[]` pages before stopping (cursor may still be present). */
export const HELIX_MAX_CONSECUTIVE_EMPTY_PAGES = 3;

export type HelixPageSlice<T> = {
	data?: T[];
	pagination?: { cursor?: string };
};

/** True when caller should fetch the next page using `pagination.cursor`. */
export function shouldContinueHelixPagination(
	streams: unknown[],
	pagination: HelixPageSlice<unknown>['pagination'],
	consecutiveEmptyPages: number,
): boolean {
	const cursor = pagination?.cursor;
	if (!cursor) return false;
	if (streams.length > 0) return true;
	return consecutiveEmptyPages < HELIX_MAX_CONSECUTIVE_EMPTY_PAGES;
}
