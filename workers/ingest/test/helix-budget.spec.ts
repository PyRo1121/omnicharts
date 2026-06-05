import { describe, it, expect } from 'vitest';
import {
	COVERAGE_FANOUT_PHASES,
	DEFAULT_LIVE_SWEEP_MAX_PAGES,
	DEFAULT_LIVE_SWEEP_MAX_PAGES_LIGHT,
	HELIX_POINTS_PER_MINUTE,
	HELIX_SAFE_POINTS_PER_MINUTE,
} from '../src/twitch/config';
import {
	gamePassGamesPerCycleFromEnv,
	helixPhaseBudgetFromEnv,
	helixSafePointsPerMinuteFromEnv,
	liveSweepMaxPagesFromEnv,
} from '../src/twitch/helix-budget';
import {
	HelixRateBudget,
	helixBudgetAllowsFetch,
	helixBudgetGamesPerCycle,
	helixBudgetPageCap,
	helixBudgetReconcileBatches,
	helixRateLimitWaitMs,
} from '../src/twitch/rate-limit';

describe('helix budget governor', () => {
	it('caps pages when remaining points are low', () => {
		const budget = new HelixRateBudget();
		(budget as unknown as { remaining: number }).remaining = 15;
		expect(helixBudgetPageCap(budget, 80)).toBe(1);
		expect(helixBudgetPageCap(budget, 3)).toBe(1);
	});

	it('returns zero pages when budget is nearly exhausted', () => {
		const budget = new HelixRateBudget();
		(budget as unknown as { remaining: number }).remaining = 3;
		expect(helixBudgetPageCap(budget, 80)).toBe(0);
		expect(helixBudgetAllowsFetch(budget)).toBe(false);
	});

	it('allows full configured cap when budget is healthy', () => {
		const budget = new HelixRateBudget();
		expect(helixBudgetPageCap(budget, 80)).toBe(80);
		expect(helixBudgetAllowsFetch(budget)).toBe(true);
	});

	it('caps game pass slices and reconcile batches under low budget', () => {
		const budget = new HelixRateBudget();
		(budget as unknown as { remaining: number }).remaining = 15;
		expect(helixBudgetGamesPerCycle(budget, 5)).toBe(1);
		expect(helixBudgetReconcileBatches(budget, 20)).toBe(5);
	});

	it('derives 429 wait from Ratelimit-Reset header', () => {
		const resetSec = Math.floor(Date.now() / 1000) + 10;
		const waitMs = helixRateLimitWaitMs(new Headers({ 'Ratelimit-Reset': String(resetSec) }));
		expect(waitMs).toBeGreaterThanOrEqual(100);
		expect(waitMs).toBeLessThanOrEqual(10_100);
	});
});

describe('helix budget from wrangler env', () => {
	it('keeps static safe default at 720 (800 − 10% headroom)', () => {
		expect(HELIX_SAFE_POINTS_PER_MINUTE).toBe(720);
		expect(HELIX_POINTS_PER_MINUTE).toBe(800);
	});

	it('reserves catalog shard points in shards_only mode', () => {
		const env = {
			INGEST_COVERAGE_MODE: 'shards_only',
			TWITCH_MAX_TRACKED: '200',
		} as Env;
		expect(helixSafePointsPerMinuteFromEnv(env)).toBe(708);
	});

	it('splits safe budget across coverage fan-out phases in full mode', () => {
		const env = { INGEST_COVERAGE_MODE: 'full' } as Env;
		const safe = helixSafePointsPerMinuteFromEnv(env);
		expect(safe).toBe(710);
		expect(helixPhaseBudgetFromEnv(env)).toBe(Math.floor(safe / COVERAGE_FANOUT_PHASES));
		expect(COVERAGE_FANOUT_PHASES).toBe(2);
	});

	it('auto-defaults sweep pages from coverage mode when LIVE_SWEEP_MAX_PAGES unset', () => {
		expect(liveSweepMaxPagesFromEnv({ INGEST_COVERAGE_MODE: 'full' } as Env)).toBe(DEFAULT_LIVE_SWEEP_MAX_PAGES);
		expect(liveSweepMaxPagesFromEnv({ INGEST_COVERAGE_MODE: 'shards_only' } as Env)).toBe(DEFAULT_LIVE_SWEEP_MAX_PAGES_LIGHT);
	});

	it('honors explicit wrangler sweep and game-pass caps', () => {
		const env = {
			INGEST_COVERAGE_MODE: 'full',
			LIVE_SWEEP_MAX_PAGES: '40',
			GAME_PASS_GAMES_PER_CYCLE: '5',
		} as Env;
		expect(liveSweepMaxPagesFromEnv(env)).toBe(40);
		expect(gamePassGamesPerCycleFromEnv(env)).toBe(5);
	});

	it('uses light game-pass default outside full mode', () => {
		expect(gamePassGamesPerCycleFromEnv({ INGEST_COVERAGE_MODE: 'shards_only' } as Env)).toBe(2);
	});
});
