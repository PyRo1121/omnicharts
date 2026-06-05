import { formatHoursWatched } from '@omnicharts/rollup';
import { getIngestBaseUrl } from '$lib/server/ingest';
import { loadChannelDetail } from '$lib/server/channel';
import type { ServerLoadContext } from '$lib/server/load-context';

export type SearchResultRow = {
	id: string;
	slug: string;
	displayName: string;
	avatarUrl: string | null;
	platform: string;
	hoursWatched7d: string | null;
};

type IngestSearchResponse = {
	results: {
		id: string;
		slug: string;
		display_name: string;
		avatar_url: string | null;
		platform_id: string;
	}[];
};

export async function searchChannels(
	fetchFn: typeof fetch,
	opts: { q: string; platform?: string; limit?: number }
): Promise<{ results: SearchResultRow[]; error: boolean }> {
	const q = opts.q.trim();
	if (q.length < 2) return { results: [], error: false };

	const params = new URLSearchParams({
		q,
		platform: opts.platform ?? 'twitch',
		limit: String(opts.limit ?? 25)
	});

	try {
		const res = await fetchFn(`${getIngestBaseUrl()}/v1/search/channels?${params}`, {
			headers: { accept: 'application/json' }
		});
		if (!res.ok) return { results: [], error: true };
		const body = (await res.json()) as IngestSearchResponse;
		return {
			results: (body.results ?? []).map((r) => ({
				id: r.id,
				slug: r.slug,
				displayName: r.display_name,
				avatarUrl: r.avatar_url,
				platform: r.platform_id,
				hoursWatched7d: null
			})),
			error: false
		};
	} catch {
		return { results: [], error: true };
	}
}

export async function enrichSearchResultsWithRollups(
	ctx: ServerLoadContext,
	results: SearchResultRow[]
): Promise<SearchResultRow[]> {
	if (results.length === 0) return results;

	return Promise.all(
		results.map(async (row) => {
			if (row.platform !== 'twitch') return row;

			const detail = await loadChannelDetail(ctx, row.slug, row.platform, '7d');
			const hoursWatched7d =
				detail.source === 'live' && detail.totals.hoursWatched > 0
					? formatHoursWatched(detail.totals.hoursWatched)
					: null;

			return { ...row, hoursWatched7d };
		})
	);
}
