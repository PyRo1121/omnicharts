/** In-worker token bucket per IP for public ingest reads (no KV binding). */

const buckets = new Map<string, { tokens: number; lastRefillMs: number }>();

const DEFAULT_LIMIT_PER_MINUTE = 60;
const DEV_LIMIT_PER_MINUTE = 10_000;

function rateLimitPerMinute(env: Env): number {
	const raw = env.INGEST_RATE_LIMIT_PER_MINUTE?.trim();
	if (raw) {
		const n = Number(raw);
		if (Number.isFinite(n) && n > 0) return n;
	}
	return env.ENVIRONMENT === 'production' ? DEFAULT_LIMIT_PER_MINUTE : DEV_LIMIT_PER_MINUTE;
}

export function isPublicRateLimitBypassed(env: Env): boolean {
	if (env.INGEST_RATE_LIMIT_DISABLED === '1') return true;
	if (env.ENVIRONMENT !== 'production') return true;
	return false;
}

export function isPublicRateLimitedPath(pathname: string): boolean {
	return pathname.startsWith('/v1/');
}

function clientKey(request: Request): string {
	return (
		request.headers.get('CF-Connecting-IP') ??
		request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
		'local'
	);
}

/**
 * Returns 429 Response when over limit; null when allowed.
 * @see https://developers.cloudflare.com/workers/platform/limits/
 */
export function checkPublicRateLimit(
	request: Request,
	env: Env,
	pathname = new URL(request.url).pathname
): Response | null {
	if (!isPublicRateLimitedPath(pathname)) return null;
	if (isPublicRateLimitBypassed(env)) return null;

	const limit = rateLimitPerMinute(env);
	const key = `${clientKey(request)}:${limit}`;
	const now = Date.now();
	let bucket = buckets.get(key);
	if (!bucket) {
		bucket = { tokens: limit, lastRefillMs: now };
		buckets.set(key, bucket);
	}

	const elapsedMs = now - bucket.lastRefillMs;
	if (elapsedMs >= 60_000) {
		bucket.tokens = limit;
		bucket.lastRefillMs = now;
	}

	if (bucket.tokens <= 0) {
		return Response.json(
			{ error: { code: 'rate_limited', message: 'Too many requests' } },
			{
				status: 429,
				headers: {
					'content-type': 'application/json',
					'retry-after': '60'
				}
			}
		);
	}

	bucket.tokens -= 1;
	return null;
}

/** Test helper — reset in-memory buckets between cases. */
export function resetPublicRateLimitBucketsForTests(): void {
	buckets.clear();
}
