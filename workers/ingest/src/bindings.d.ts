/** Wrangler secrets / vars (see wrangler.jsonc + .dev.vars) */
declare interface Env {
	TWITCH_MIN_VIEWERS?: string;
	TWITCH_MAX_TRACKED?: string;
	ENVIRONMENT?: string;
	INGEST_COVERAGE_MODE?: string;
	LIVE_SWEEP_MAX_PAGES?: string;
	GAME_PASS_GAMES_PER_CYCLE?: string;
	INGEST_RATE_LIMIT_DISABLED?: string;
	INGEST_RATE_LIMIT_PER_MINUTE?: string;
	D1_META_LOG?: string;
	SAMPLE_ARCHIVE_ENABLED?: string;
	/** Min rows per batch before one R2 PutObject (default 10). Ignored when SAMPLE_ARCHIVE_ENABLED≠1. */
	SAMPLE_ARCHIVE_MIN_ROWS?: string;
	/** Max EventSub lifecycle subs to create per sync run (default 125). See wrangler.jsonc. */
	EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN?: string;
}
