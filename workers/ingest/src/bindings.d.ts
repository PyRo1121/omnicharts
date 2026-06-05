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
	/** Kick Dev Public API — Phase 3 (ADR-003). Omit locally until dev.kick.com app registered. */
	KICK_CLIENT_ID?: string;
	KICK_CLIENT_SECRET?: string;
	KICK_MAX_TRACKED?: string;
	KICK_MIN_VIEWERS?: string;
	/** RSA PEM from GET /public/v1/public-key — webhook signature verify (ADR-003). */
	KICK_WEBHOOK_PUBLIC_KEY?: string;
	/** YouTube Data API key — Phase 3 (docs/05). Omit locally until GCP project registered. */
	YOUTUBE_API_KEY?: string;
	YOUTUBE_MAX_TRACKED?: string;
	YOUTUBE_MIN_VIEWERS?: string;
}
