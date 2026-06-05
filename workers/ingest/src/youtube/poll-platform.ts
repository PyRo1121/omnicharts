/**
 * YouTube ingest entry — Phase 3.
 * Tracked live video batch poll only (`poll_youtube_tracked`); never cron `search.list`.
 * @see docs/05-ingestion-per-platform.md
 */

import { runYoutubeCatalogPoll } from './poll';

/** Queue `poll_youtube_tracked` handler — GET videos.list in ≤50-ID batches. */
export async function runYoutubePollPlatform(env: Env): Promise<void> {
	await runYoutubeCatalogPoll(env);
}
