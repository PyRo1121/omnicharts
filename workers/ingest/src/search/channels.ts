/**
 * Channel search — docs/16-search-and-resolution.md (FTS deferred; prefix LIKE fallback)
 */

import { isPlatformId, PLATFORM_TWITCH } from '@omnicharts/domain';

export type ChannelSearchRow = {
	id: string;
	slug: string;
	display_name: string;
	avatar_url: string | null;
	platform_id: string;
};

export function normalizeSearchQuery(raw: string): string {
	return raw
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/^@+/, '')
		.trim()
		.toLowerCase();
}

/** Escape `%`, `_`, and `\` for SQL LIKE … ESCAPE '\\'. */
export function escapeLikePattern(raw: string): string {
	return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export type SearchQueryError = 'invalid_query' | 'invalid_limit' | 'invalid_platform';

export type ParsedSearchChannelsQuery =
	| { ok: true; platformId: string; query: string; limit: number }
	| { ok: false; error: SearchQueryError };

const SEARCH_QUERY_MAX_LENGTH = 100;

export function parseSearchChannelsQuery(url: URL): ParsedSearchChannelsQuery {
	const q = normalizeSearchQuery(url.searchParams.get('q') ?? '');
	if (q.length < 2 || q.length > SEARCH_QUERY_MAX_LENGTH) {
		return { ok: false, error: 'invalid_query' };
	}

	const platformRaw = url.searchParams.get('platform') ?? PLATFORM_TWITCH;
	if (!isPlatformId(platformRaw)) {
		return { ok: false, error: 'invalid_platform' };
	}

	const limitRaw = url.searchParams.get('limit') ?? '10';
	const limitNum = Number(limitRaw);
	if (Number.isNaN(limitNum) || limitNum < 1) {
		return { ok: false, error: 'invalid_limit' };
	}

	const limit = Math.min(25, Math.max(1, Math.floor(limitNum)));
	return { ok: true, platformId: platformRaw, query: q, limit };
}

export async function searchChannels(
	db: D1Database,
	opts: { platformId: string; query: string; limit?: number }
): Promise<ChannelSearchRow[]> {
	const q = normalizeSearchQuery(opts.query);
	if (q.length < 2) return [];

	const limit = Math.min(opts.limit ?? 10, 25);
	const likeQ = escapeLikePattern(q);
	const slugPrefix = `${likeQ}%`;
	const nameContains = `%${likeQ}%`;

	const { results } = await db
		.prepare(
			`SELECT c.id, c.slug, c.display_name, c.avatar_url, c.platform_id
       FROM channels c
       WHERE c.platform_id = ?
         AND (
           lower(c.slug) = ?
           OR lower(c.slug) LIKE ? ESCAPE '\\'
           OR lower(c.display_name) LIKE ? ESCAPE '\\'
         )
       ORDER BY
         CASE WHEN lower(c.slug) = ? THEN 0 ELSE 1 END,
         c.last_seen_at DESC
       LIMIT ?`
		)
		.bind(opts.platformId, q, slugPrefix, nameContains, q, limit)
		.all<ChannelSearchRow>();

	return results ?? [];
}
