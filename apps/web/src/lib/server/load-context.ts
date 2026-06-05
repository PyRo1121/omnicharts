import { getD1 } from '$lib/server/d1';
import type { WebRankingEnv } from '$lib/server/ranking-env';

/** Server load / API deps: colocated D1 when on Pages; ingest HTTP fallback when absent. */
export type ServerLoadContext = {
	fetch: typeof globalThis.fetch;
	db: D1Database | null;
	/** Wrangler vars from adapter-cloudflare `platform.env` (ranking eligibility). */
	cfEnv: WebRankingEnv | null;
};

export function serverLoadContext(
	fetchFn: typeof globalThis.fetch,
	platform: App.Platform | null | undefined
): ServerLoadContext {
	return {
		fetch: fetchFn,
		db: getD1(platform),
		cfEnv: (platform?.env as WebRankingEnv | undefined) ?? null
	};
}
