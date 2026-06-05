/**
 * YouTube ingest entry — Phase 3.
 * `videos.list` batch poll only; never cron `search.list`.
 * @see docs/05-ingestion-per-platform.md
 */

/** Reserved queue path — implementation follows Twitch freeze gate (M5). */
export async function runYoutubePollPlatform(_env: Env): Promise<void> {
	// Phase 3: batched videos.list on tracked live video ids
}
