/**
 * In-worker JSON cache for GET /v1/rankings/* — no Workers KV binding.
 * 60s TTL aligns with Cache-Control on rankings responses.
 * @see docs/audits/cloudflare-free-tier-audit.md (Lane 7/10)
 */

export const RANKINGS_CACHE_TTL_MS = 60_000;

type CacheEntry = { body: string; expiresAtMs: number };

const channelsCache = new Map<string, CacheEntry>();
const gamesCache = new Map<string, CacheEntry>();

function getCached(map: Map<string, CacheEntry>, key: string): string | null {
	const entry = map.get(key);
	if (!entry) return null;
	if (Date.now() >= entry.expiresAtMs) {
		map.delete(key);
		return null;
	}
	return entry.body;
}

function setCached(map: Map<string, CacheEntry>, key: string, body: string): void {
	map.set(key, { body, expiresAtMs: Date.now() + RANKINGS_CACHE_TTL_MS });
}

export function rankingsChannelsCacheKey(opts: {
	platform: string;
	period: string;
	limit: number;
	minAverageViewers: number;
	minAirtimeMinutes: number;
	language?: string | null;
}): string {
	const lang = opts.language ?? '';
	return `ch:${opts.platform}:${opts.period}:${opts.limit}:${opts.minAverageViewers}:${opts.minAirtimeMinutes}:${lang}`;
}

export function rankingsGamesCacheKey(opts: {
	platform: string;
	period: string;
	limit: number;
	minAverageViewers: number;
	minAirtimeMinutes: number;
}): string {
	return `gm:${opts.platform}:${opts.period}:${opts.limit}:${opts.minAverageViewers}:${opts.minAirtimeMinutes}`;
}

export function getCachedRankingsChannels(key: string): string | null {
	return getCached(channelsCache, key);
}

export function setCachedRankingsChannels(key: string, body: string): void {
	setCached(channelsCache, key, body);
}

export function getCachedRankingsGames(key: string): string | null {
	return getCached(gamesCache, key);
}

export function setCachedRankingsGames(key: string, body: string): void {
	setCached(gamesCache, key, body);
}

import { publicJsonResponseHeaders } from './cors';

export function rankingsResponseHeaders(request: Request): Record<string, string> {
	return publicJsonResponseHeaders(request, 'public, max-age=60');
}

/** Test helper — reset in-memory caches between cases. */
export function resetRankingsCacheForTests(): void {
	channelsCache.clear();
	gamesCache.clear();
}
