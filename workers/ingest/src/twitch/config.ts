/** Twitch ingest caps — docs/12-channel-discovery-and-tracking.md, docs/05-ingestion-per-platform.md */

import { PLATFORM_TWITCH } from '@omnicharts/domain';

/** @deprecated Prefer `PLATFORM_TWITCH` from `@omnicharts/domain`. */
export const TWITCH_PLATFORM_ID = PLATFORM_TWITCH;

/** Helix default: 800 points/min per client ID — Twitch API guide */
export const HELIX_POINTS_PER_MINUTE = 800;

/** Fixed headroom below Twitch hard cap (800 − 80 = 720 global safe target). */
export const HELIX_HEADROOM_POINTS = 80;

/** @deprecated Use helixSafePointsPerMinuteFromEnv — static default for tests. */
export const HELIX_SAFE_POINTS_PER_MINUTE = HELIX_POINTS_PER_MINUTE - HELIX_HEADROOM_POINTS;

export const STREAMS_BATCH_SIZE = 100;

export const TOP_GAMES_FIRST = 100;

/** Games scanned per discovery run (× pages below) */
export const DISCOVERY_GAMES_TO_SCAN = 40;

export const DISCOVERY_MAX_PAGES_PER_GAME = 12;

export const DEFAULT_MIN_VIEWERS = 2;

export const DEFAULT_MAX_TRACKED = 3000;

/** Production sweep cap (100 streams/page). 80 pages ≈ 8k lives; prod wrangler often sets 40. */
export const DEFAULT_LIVE_SWEEP_MAX_PAGES = 80;

/** Free/staging auto-default when LIVE_SWEEP_MAX_PAGES unset and mode ≠ full. */
export const DEFAULT_LIVE_SWEEP_MAX_PAGES_LIGHT = 3;

/** @deprecated Use liveSweepMaxPagesFromEnv — kept for tests importing the production default. */
export const LIVE_SWEEP_MAX_PAGES = DEFAULT_LIVE_SWEEP_MAX_PAGES;

export type IngestCoverageMode = 'full' | 'shards_only' | 'sweep_only';

/** Parallel coverage fan-out queue consumers per minute (sweep+game pass + reconcile). */
export const COVERAGE_FANOUT_PHASES = 2;

/** Production game-pass slice (full top-100 games ≈ 20 min rotation). */
export const DEFAULT_GAME_PASS_GAMES_PRODUCTION = 5;

/** Light profile when mode ≠ full and GAME_PASS_GAMES_PER_CYCLE unset. */
export const DEFAULT_GAME_PASS_GAMES_LIGHT = 2;

/** @deprecated Use gamePassGamesPerCycleFromEnv */
export const GAME_PASS_GAMES_PER_CYCLE = DEFAULT_GAME_PASS_GAMES_PRODUCTION;

/** Reconcile: direct user_id lookups for channels seen recently. */
export const RECONCILE_RECENT_HOURS = 3;
export const RECONCILE_MAX_CHANNELS = 1500;

/** Tier B profile enrichment — GET /users + GET /channels (1 pt each, batch 100). */
export const ENRICH_MAX_CHANNELS_PER_RUN = 500;
/** Pre-rollup follower refresh — lower cap to avoid worker CPU/memory spikes on large sample days. */
export const ENRICH_BEFORE_ROLLUP_MAX_CHANNELS = 100;
export const ENRICH_STALE_HOURS = 24;

/**
 * Max tracked channels with *missing* lifecycle subs to create per sync run (2 Helix POSTs each).
 * Tradeoff: higher = faster catch-up on new channels but more subrequests/CPU per queue message;
 * lower = safer on Free/staging. Full catalog (TWITCH_MAX_TRACKED) advances over multiple 6h crons
 * via ingest_metadata `eventsub_sync_cursor`. Override with EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN.
 */
export const DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN = 125;

/** @deprecated Use eventsubSyncMaxChannelsFromEnv — static default for tests. */
export const EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN = DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN;

export function eventsubSyncMaxChannelsFromEnv(env: Env): number {
	const n = Number(
		env.EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN ?? DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN
	);
	return Number.isFinite(n) && n > 0
		? Math.floor(n)
		: DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN;
}

export function minViewersFromEnv(env: Env): number {
	const n = Number(env.TWITCH_MIN_VIEWERS ?? DEFAULT_MIN_VIEWERS);
	return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_VIEWERS;
}

export function maxTrackedFromEnv(env: Env): number {
	const n = Number(env.TWITCH_MAX_TRACKED ?? DEFAULT_MAX_TRACKED);
	return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_TRACKED;
}

/** Public rankings airtime gate — default 60 (docs/12). Local dev may set 1 for checkpoint. */
export function rankingMinAirtimeMinutesFromEnv(env: Env): number {
	const n = Number(env.TWITCH_RANKING_MIN_AIRTIME_MINUTES ?? 60);
	return Number.isFinite(n) && n >= 0 ? n : 60;
}

export function ingestCoverageModeFromEnv(env: Env): IngestCoverageMode {
	const raw = env.INGEST_COVERAGE_MODE?.trim().toLowerCase();
	if (raw === 'shards_only' || raw === 'sweep_only' || raw === 'full') return raw;
	return 'full';
}
