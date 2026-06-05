/** Rollup SSR + public JSON — docs/11-cloudflare-deployment.md (60s CDN). */
export const ROLLUP_CACHE_CONTROL = 'public, max-age=60';

/** Search pages + `/api/v1/search` — docs/16-search-and-resolution.md */
export const SEARCH_CACHE_CONTROL = 'private, max-age=30';

type SetHeaders = (headers: Record<string, string>) => void;

export function applyRollupPageCache(setHeaders: SetHeaders): void {
	setHeaders({ 'cache-control': ROLLUP_CACHE_CONTROL });
}

export function applySearchPageCache(setHeaders: SetHeaders): void {
	setHeaders({ 'cache-control': SEARCH_CACHE_CONTROL });
}
