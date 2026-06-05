/**
 * Channel search — docs/16-search-and-resolution.md (FTS deferred; prefix LIKE fallback)
 */

import { isPlatformId, parseOptionalLanguageParam, PLATFORM_TWITCH, PLATFORM_YOUTUBE } from '@omnicharts/domain';
import { shouldTryYoutubeApiSeed } from '../youtube/channel-id';
import { seedYoutubeChannelByQuery } from '../youtube/seed';

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

export type SearchQueryError = 'invalid_query' | 'invalid_limit' | 'invalid_platform' | 'invalid_language';

export type ParsedSearchChannelsQuery =
	| { ok: true; platformId: string; query: string; limit: number; language: string | null }
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
	const languageParsed = parseOptionalLanguageParam(url.searchParams.get('language'));
	if (!languageParsed.ok) {
		return { ok: false, error: languageParsed.error };
	}
	return {
		ok: true,
		platformId: platformRaw,
		query: q,
		limit,
		language: languageParsed.language
	};
}

export async function searchChannels(
	db: D1Database,
	opts: { platformId: string; query: string; limit?: number; language?: string | null }
): Promise<ChannelSearchRow[]> {
	const q = normalizeSearchQuery(opts.query);
	if (q.length < 2) return [];

	const limit = Math.min(opts.limit ?? 10, 25);
	const likeQ = escapeLikePattern(q);
	const slugPrefix = `${likeQ}%`;
	const nameContains = `%${likeQ}%`;
	const language = opts.language ?? null;

	const languageFilter = language ? ' AND lower(c.language) = ?' : '';
	const sql = `SELECT c.id, c.slug, c.display_name, c.avatar_url, c.platform_id
       FROM channels c
       WHERE c.platform_id = ?
         AND (
           lower(c.slug) = ?
           OR lower(c.slug) LIKE ? ESCAPE '\\'
           OR lower(c.display_name) LIKE ? ESCAPE '\\'
         )${languageFilter}
       ORDER BY
         CASE WHEN lower(c.slug) = ? THEN 0 ELSE 1 END,
         c.last_seen_at DESC
       LIMIT ?`;

	const binds: unknown[] = [opts.platformId, q, slugPrefix, nameContains];
	if (language) binds.push(language);
	binds.push(q, limit);

	const { results } = await db.prepare(sql).bind(...binds).all<ChannelSearchRow>();

	return results ?? [];
}

/** DB search; on-demand YouTube channels.list seed for exact handle / UC id (docs/05). */
export async function searchChannelsWithYoutubeSeed(
	db: D1Database,
	env: Env,
	opts: { platformId: string; query: string; limit?: number; language?: string | null }
): Promise<ChannelSearchRow[]> {
	const results = await searchChannels(db, opts);
	if (results.length > 0 || opts.platformId !== PLATFORM_YOUTUBE) return results;
	if (!shouldTryYoutubeApiSeed(opts.query)) return results;

	const seeded = await seedYoutubeChannelByQuery(env, opts.query);
	return seeded ? [seeded] : results;
}
