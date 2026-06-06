/**
 * Helix rate budget derived from wrangler vars — docs/21-twitch-ingest-libraries.md.
 * Operators set coverage mode + caps in wrangler.jsonc; no manual `.dev.vars` tuning.
 */

import {
	COVERAGE_FANOUT_PHASES,
	DEFAULT_GAME_PASS_GAMES_LIGHT,
	DEFAULT_GAME_PASS_GAMES_PRODUCTION,
	DEFAULT_LIVE_SWEEP_MAX_PAGES,
	DEFAULT_LIVE_SWEEP_MAX_PAGES_LIGHT,
	HELIX_HEADROOM_POINTS,
	HELIX_POINTS_PER_MINUTE,
	ingestCoverageModeFromEnv,
	maxTrackedFromEnv,
	STREAMS_BATCH_SIZE,
} from './config';

/** Amortized reserve for 6h discovery / EventSub bursts (points/min). */
export const HELIX_DISCOVERY_RESERVE_POINTS = 10;

/** Global safe Helix budget before splitting across parallel queue consumers. */
export function helixSafePointsPerMinuteFromEnv(env: Env): number {
	let budget = HELIX_POINTS_PER_MINUTE - HELIX_HEADROOM_POINTS;

	if (ingestCoverageModeFromEnv(env) === 'shards_only') {
		budget -= Math.ceil(maxTrackedFromEnv(env) / STREAMS_BATCH_SIZE);
	}

	budget -= HELIX_DISCOVERY_RESERVE_POINTS;
	return Math.max(50, budget);
}

/**
 * Per-queue-consumer Helix budget.
 * `full` mode uses one coalesced consumer (sweep + game pass + reconcile sequential).
 */
export function helixPhaseBudgetFromEnv(env: Env): number {
	const safe = helixSafePointsPerMinuteFromEnv(env);
	if (ingestCoverageModeFromEnv(env) === 'full') {
		return Math.max(20, Math.floor(safe / COVERAGE_FANOUT_PHASES));
	}
	return safe;
}

export function liveSweepMaxPagesFromEnv(env: Env): number {
	const raw = env.LIVE_SWEEP_MAX_PAGES;
	if (raw != null && raw.trim() !== '') {
		const n = Number(raw);
		if (Number.isFinite(n) && n > 0) return Math.floor(n);
	}
	return ingestCoverageModeFromEnv(env) === 'full' ? DEFAULT_LIVE_SWEEP_MAX_PAGES : DEFAULT_LIVE_SWEEP_MAX_PAGES_LIGHT;
}

export function gamePassGamesPerCycleFromEnv(env: Env): number {
	const raw = env.GAME_PASS_GAMES_PER_CYCLE;
	if (raw != null && raw.trim() !== '') {
		const n = Number(raw);
		if (Number.isFinite(n) && n > 0) return Math.floor(n);
	}
	return ingestCoverageModeFromEnv(env) === 'full' ? DEFAULT_GAME_PASS_GAMES_PRODUCTION : DEFAULT_GAME_PASS_GAMES_LIGHT;
}
