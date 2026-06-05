/**
 * Kick ingest entry — Phase 3.
 * Catalog batch poll only (`poll_kick_tracked`); no global sweep fan-out.
 * @see docs/adr/0003-kick-ingest-strategy.md
 */

import { runKickCatalogPoll } from './poll';

/** Queue `poll_kick_tracked` handler — GET /public/v1/livestreams in ≤50-ID batches. */
export async function runKickPollPlatform(env: Env): Promise<void> {
	await runKickCatalogPoll(env);
}
