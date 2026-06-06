import { getD1 } from '$lib/server/d1';
import type { WebRankingEnv } from '$lib/server/ranking-env';

/** Server load / API deps: colocated D1 when on Pages; ingest HTTP fallback when absent. */
export type ServerLoadContext = {
	fetch: typeof globalThis.fetch;
	db: D1Database | null;
	/** Wrangler vars from adapter-cloudflare `platform.env` (ranking eligibility). */
	cfEnv: WebRankingEnv | null;
};

type ServerPlatform = { env?: { DB?: D1Database } & WebRankingEnv };

export function cfRankingEnv(platform: ServerPlatform | null | undefined): WebRankingEnv | null {
	return platform?.env ?? null;
}

export function serverLoadContext(fetchFn: typeof globalThis.fetch, platform: ServerPlatform | null | undefined): ServerLoadContext {
	return {
		fetch: fetchFn,
		db: getD1(platform),
		cfEnv: cfRankingEnv(platform),
	};
}
