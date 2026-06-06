/** Mutating POST /admin/* — shared secret from env ADMIN_API_KEY (wrangler secret in prod). */

import { ingestWarn } from '../log';

let localBypassWarned = false;

function adminKeysEqual(provided: string, expected: string): boolean {
	if (provided.length !== expected.length) return false;
	const enc = new TextEncoder();
	const a = enc.encode(provided);
	const b = enc.encode(expected);
	const timingSafeEqual = (crypto as Crypto & { timingSafeEqual?: (left: Uint8Array, right: Uint8Array) => boolean }).timingSafeEqual;
	if (typeof timingSafeEqual === 'function') {
		return timingSafeEqual(a, b);
	}
	return provided === expected;
}

function extractProvidedKey(request: Request): string | null {
	const direct = request.headers.get('X-Admin-Api-Key');
	if (direct) return direct;

	const auth = request.headers.get('Authorization');
	if (!auth) return null;
	const match = auth.match(/^Bearer\s+(.+)$/i);
	return match?.[1] ?? null;
}

/**
 * Returns 401 Response when auth fails; null when request may proceed.
 * Non-development without ADMIN_API_KEY: 503. Local dev (`ENVIRONMENT=development`): unset key allows with a one-time warning.
 */
export function requireAdminApiKey(request: Request, env: Env): Response | null {
	const expected = env.ADMIN_API_KEY?.trim();
	if (!expected) {
		if (env.ENVIRONMENT !== 'development') {
			return Response.json(
				{
					error: {
						code: 'service_unavailable',
						message: 'Admin API is not configured (ADMIN_API_KEY missing)',
					},
				},
				{ status: 503, headers: { 'content-type': 'application/json' } },
			);
		}
		if (!localBypassWarned) {
			ingestWarn('[ingest] ADMIN_API_KEY unset — POST /admin/* routes accept any caller (local dev only)');
			localBypassWarned = true;
		}
		return null;
	}

	const provided = extractProvidedKey(request);
	if (!provided || !adminKeysEqual(provided, expected)) {
		return Response.json(
			{ error: { code: 'unauthorized', message: 'Invalid or missing admin API key' } },
			{ status: 401, headers: { 'content-type': 'application/json' } },
		);
	}

	return null;
}

export function isAdminPostPath(pathname: string, method: string): boolean {
	return method === 'POST' && pathname.startsWith('/admin/');
}

/** Legacy GET rankings aliases — redirect to /v1 in index.ts. */
export function isAdminRankingsGetPath(pathname: string, method: string): boolean {
	if (method !== 'GET') return false;
	return pathname === '/admin/twitch/rankings' || pathname === '/admin/twitch/rankings/games';
}
