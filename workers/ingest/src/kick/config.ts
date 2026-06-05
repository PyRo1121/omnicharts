/** Kick ingest caps — docs/05, docs/12, ADR-003 */

import { KICK_REQUESTS_PER_MIN_BUDGET } from '../ingest-budget';

/** OpenAPI: up to 50 `broadcaster_user_id` per GET /public/v1/livestreams */
export const KICK_LIVESTREAMS_BATCH_SIZE = 50;

/** docs/12 catalog cap mid-range */
export const DEFAULT_KICK_MAX_TRACKED = 800;

export const DEFAULT_KICK_MIN_VIEWERS = 2;

/** Category discovery — mirror twitch DISCOVERY_GAMES_TO_SCAN (docs/12) */
export const DISCOVERY_CATEGORIES_TO_SCAN = 40;

/** GET /public/v1/livestreams max limit (OpenAPI) */
export const DISCOVERY_CATEGORY_LIVESTREAMS_LIMIT = 100;

/** GET /public/v2/categories page size when building scan list */
export const DISCOVERY_CATEGORY_LIST_LIMIT = 100;

export const KICK_API_BASE = 'https://api.kick.com';
export const KICK_OAUTH_TOKEN_URL = 'https://id.kick.com/oauth/token';

export { KICK_REQUESTS_PER_MIN_BUDGET };

export function kickMinViewersFromEnv(env: Env): number {
	const n = Number(env.KICK_MIN_VIEWERS ?? env.TWITCH_MIN_VIEWERS ?? DEFAULT_KICK_MIN_VIEWERS);
	return Number.isFinite(n) && n >= 0 ? n : DEFAULT_KICK_MIN_VIEWERS;
}

export function kickMaxTrackedFromEnv(env: Env): number {
	const n = Number(env.KICK_MAX_TRACKED ?? DEFAULT_KICK_MAX_TRACKED);
	return Number.isFinite(n) && n > 0 ? n : DEFAULT_KICK_MAX_TRACKED;
}

export function kickCredentialsConfigured(env: Env): boolean {
	return Boolean(env.KICK_CLIENT_ID?.trim() && env.KICK_CLIENT_SECRET?.trim());
}
