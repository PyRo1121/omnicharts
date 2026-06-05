/** Optional Pages vars for ranking eligibility parity with ingest (doc 11). */
declare global {
	interface Env {
		TWITCH_MIN_VIEWERS?: string;
		TWITCH_RANKING_MIN_AIRTIME_MINUTES?: string;
		TWITCH_MAX_TRACKED?: string;
		LIVE_SWEEP_MAX_PAGES?: string;
		INGEST_COVERAGE_MODE?: string;
	}
}
