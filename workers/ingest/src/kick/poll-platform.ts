/**
 * Kick ingest entry — Phase 3.
 * Catalog batch poll only (`poll_kick_tracked`); no global sweep fan-out.
 * @see docs/adr/0003-kick-ingest-strategy.md
 */

/** Reserved queue path — implementation follows Twitch freeze gate (M5). */
export async function runKickPollPlatform(_env: Env): Promise<void> {
	// Phase 3: GET /public/v1/livestreams in ≤50-ID batches
}
