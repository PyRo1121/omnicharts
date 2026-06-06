import type { PlatformId } from '@omnicharts/domain';
import { formatHoursWatched } from '@omnicharts/rollup';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { isPlatformId, parseIngestSearchResponse } from '$lib/server/json-guards';
import { loadChannelDetail } from '$lib/server/channel';
import type { ServerLoadContext } from '$lib/server/load-context';

const SEARCH_HW_PLATFORMS = new Set<PlatformId>(['twitch', 'kick', 'youtube']);

/** Cap parallel channel-detail loads per search — D1 / ingest quota (docs/23). */
export const SEARCH_HW_ENRICH_MAX = 8;

export type SearchResultRow = {
	id: string;
	slug: string;
	displayName: string;
	avatarUrl: string | null;
	platform: string;
	hoursWatched7d: string | null;
};

export async function searchChannels(
	fetchFn: typeof fetch,
	opts: { q: string; platform?: string; limit?: number; language?: string | null },
): Promise<{ results: SearchResultRow[]; error: boolean }> {
	const q = opts.q.trim();
	if (q.length < 2) return { results: [], error: false };

	const params = new URLSearchParams({
		q,
		platform: opts.platform ?? 'twitch',
		limit: String(opts.limit ?? 25),
	});
	if (opts.language) params.set('language', opts.language);

	try {
		const res = await fetchFn(`${getIngestBaseUrl()}/v1/search/channels?${params}`, {
			headers: { accept: 'application/json' },
		});
		if (!res.ok) return { results: [], error: true };
		const body = parseIngestSearchResponse(await res.json());
		if (!body) return { results: [], error: true };
		return {
			results: (body.results ?? []).map((r) => ({
				id: r.id,
				slug: r.slug,
				displayName: r.display_name,
				avatarUrl: r.avatar_url,
				platform: r.platform_id,
				hoursWatched7d: null,
			})),
			error: false,
		};
	} catch {
		return { results: [], error: true };
	}
}

async function enrichRowWithHoursWatched(ctx: ServerLoadContext, row: SearchResultRow): Promise<SearchResultRow> {
	if (!isPlatformId(row.platform) || !SEARCH_HW_PLATFORMS.has(row.platform)) return row;

	const detail = await loadChannelDetail(ctx, row.slug, row.platform, '7d');
	const hoursWatched7d = detail.source === 'live' && detail.totals.hoursWatched > 0 ? formatHoursWatched(detail.totals.hoursWatched) : null;

	return { ...row, hoursWatched7d };
}

export async function enrichSearchResultsWithRollups(ctx: ServerLoadContext, results: SearchResultRow[]): Promise<SearchResultRow[]> {
	if (results.length === 0) return results;

	const head = results.slice(0, SEARCH_HW_ENRICH_MAX);
	const tail = results.slice(SEARCH_HW_ENRICH_MAX);
	const enrichedHead = await Promise.all(head.map((row) => enrichRowWithHoursWatched(ctx, row)));
	return [...enrichedHead, ...tail];
}
