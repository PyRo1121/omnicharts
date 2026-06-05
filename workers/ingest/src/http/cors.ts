/**
 * Reflect CORS for known web origins only (P2 tighten vs `*`).
 * @see docs/audits/cloudflare-free-tier-audit.md Lane 4.6
 */

const ALLOWED_ORIGIN_PREFIXES = ['http://127.0.0.1:', 'http://localhost:', 'https://omnicharts.com', 'https://www.omnicharts.com'] as const;

function isAllowedOrigin(origin: string): boolean {
	if (ALLOWED_ORIGIN_PREFIXES.some((p) => origin.startsWith(p))) return true;
	if (origin.endsWith('.pages.dev')) return true;
	return false;
}

/** Returns ACAO + Vary when Origin is allowlisted; empty object otherwise. */
export function corsAllowOrigin(request: Request): Record<string, string> {
	const origin = request.headers.get('Origin');
	if (!origin || !isAllowedOrigin(origin)) return {};
	return {
		'access-control-allow-origin': origin,
		vary: 'Origin',
	};
}

export function publicJsonResponseHeaders(request: Request, cacheControl: string): Record<string, string> {
	return {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': cacheControl,
		...corsAllowOrigin(request),
	};
}
