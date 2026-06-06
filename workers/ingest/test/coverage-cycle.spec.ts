import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv } from './helpers';
import { helixSafePointsPerMinuteFromEnv } from '../src/twitch/helix-budget';
import * as sweep from '../src/twitch/sweep';
import * as gamePass from '../src/twitch/game-pass';
import * as reconcile from '../src/twitch/reconcile';
import { runTwitchCoverageCycle } from '../src/twitch/coverage';

describe('runTwitchCoverageCycle', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('runs global sweep, game pass, and reconcile without inline enrichment', async () => {
		vi.spyOn(sweep, 'runTwitchLiveSweep').mockResolvedValue({
			pagesFetched: 1,
			streamsSeen: 1,
			channelsIngested: 1,
			duplicatesSkipped: 0,
			stoppedBecause: 'end_of_catalog',
		});
		vi.spyOn(gamePass, 'runTwitchGamePass').mockResolvedValue({
			gamesScanned: 1,
			pagesFetched: 1,
			streamsSeen: 1,
			channelsIngested: 1,
			duplicatesSkipped: 0,
			startGameIndex: 0,
			topGamesHelixPoints: 0,
		});
		vi.spyOn(reconcile, 'runTwitchReconcileRecent').mockResolvedValue({
			candidates: 1,
			platformChannelIds: ['123'],
			batches: 1,
			liveFound: 0,
			samplesWritten: 0,
			retired: 0,
		});
		const enrich = await import('../src/twitch/enrich-profiles');
		const enrichSpy = vi.spyOn(enrich, 'runTwitchProfileEnrichment');

		const stats = await runTwitchCoverageCycle(testEnv());
		expect(stats.global.pagesFetched).toBe(1);
		expect(stats.gamePass.gamesScanned).toBe(1);
		expect(stats.reconcile.batches).toBe(1);
		expect(enrichSpy).not.toHaveBeenCalled();
	});

	it('shares one Helix client and seenUserIds across sweep and game pass', async () => {
		const env = testEnv({ INGEST_COVERAGE_MODE: 'full' });
		const sweepSpy = vi.spyOn(sweep, 'runTwitchLiveSweep').mockResolvedValue({
			pagesFetched: 0,
			streamsSeen: 0,
			channelsIngested: 0,
			duplicatesSkipped: 0,
			stoppedBecause: 'budget_exhausted',
		});
		const gamePassSpy = vi.spyOn(gamePass, 'runTwitchGamePass').mockResolvedValue({
			gamesScanned: 0,
			pagesFetched: 0,
			streamsSeen: 0,
			channelsIngested: 0,
			duplicatesSkipped: 0,
			startGameIndex: 0,
			topGamesHelixPoints: 0,
		});
		vi.spyOn(reconcile, 'runTwitchReconcileRecent').mockResolvedValue({
			candidates: 0,
			platformChannelIds: [],
			batches: 0,
			liveFound: 0,
			samplesWritten: 0,
			retired: 0,
		});

		await runTwitchCoverageCycle(env);

		const sweepOpts = sweepSpy.mock.calls[0]?.[1];
		const gamePassOpts = gamePassSpy.mock.calls[0]?.[1];
		expect(sweepOpts.client).toBeDefined();
		expect(sweepOpts.client).toBe(gamePassOpts.client);
		expect(sweepOpts.seenUserIds).toBe(gamePassOpts.seenUserIds);
		expect(sweepOpts.client!.getBudget().snapshot().remaining).toBe(helixSafePointsPerMinuteFromEnv(env));
	});
});
