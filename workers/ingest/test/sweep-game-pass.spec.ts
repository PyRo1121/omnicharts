import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv } from './helpers';
import { runTwitchSweepAndGamePass, runTwitchCoverageQueuePass } from '../src/twitch/sweep-game-pass';
import * as sweep from '../src/twitch/sweep';
import * as gamePass from '../src/twitch/game-pass';
import * as reconcile from '../src/twitch/reconcile';

vi.mock('../src/twitch/sweep', () => ({
	runTwitchLiveSweep: vi.fn(),
}));
vi.mock('../src/twitch/game-pass', () => ({
	runTwitchGamePass: vi.fn(),
}));
vi.mock('../src/twitch/reconcile', () => ({
	runTwitchReconcileRecent: vi.fn(),
}));

describe('runTwitchSweepAndGamePass', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('runs sweep then game pass with the same seenUserIds set', async () => {
		const sweepStats = {
			pagesFetched: 1,
			streamsSeen: 1,
			channelsIngested: 1,
			duplicatesSkipped: 0,
			stoppedBecause: 'end_of_catalog' as const,
		};
		const gameStats = {
			gamesScanned: 1,
			pagesFetched: 1,
			streamsSeen: 0,
			channelsIngested: 0,
			duplicatesSkipped: 1,
			startGameIndex: 0,
			topGamesHelixPoints: 0,
		};
		vi.mocked(sweep.runTwitchLiveSweep).mockResolvedValue(sweepStats);
		vi.mocked(gamePass.runTwitchGamePass).mockResolvedValue(gameStats);

		const result = await runTwitchSweepAndGamePass(testEnv({ INGEST_COVERAGE_MODE: 'full' }));

		expect(result.global).toEqual(sweepStats);
		expect(result.gamePass).toEqual(gameStats);
		const sweepOpts = vi.mocked(sweep.runTwitchLiveSweep).mock.calls[0]?.[1];
		const gameOpts = vi.mocked(gamePass.runTwitchGamePass).mock.calls[0]?.[1];
		expect(sweepOpts?.seenUserIds).toBe(gameOpts?.seenUserIds);
		expect(sweepOpts?.client).toBe(gameOpts?.client);
	});
});

describe('runTwitchCoverageQueuePass', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('runs sweep, game pass, and reconcile with one shared client', async () => {
		vi.mocked(sweep.runTwitchLiveSweep).mockResolvedValue({
			pagesFetched: 1,
			streamsSeen: 1,
			channelsIngested: 1,
			duplicatesSkipped: 0,
			stoppedBecause: 'end_of_catalog',
		});
		vi.mocked(gamePass.runTwitchGamePass).mockResolvedValue({
			gamesScanned: 1,
			pagesFetched: 1,
			streamsSeen: 0,
			channelsIngested: 0,
			duplicatesSkipped: 0,
			startGameIndex: 0,
			topGamesHelixPoints: 0,
		});
		vi.mocked(reconcile.runTwitchReconcileRecent).mockResolvedValue({
			candidates: 0,
			platformChannelIds: [],
			batches: 0,
			liveFound: 0,
			samplesWritten: 0,
			retired: 0,
		});

		await runTwitchCoverageQueuePass(testEnv({ INGEST_COVERAGE_MODE: 'full' }));

		expect(sweep.runTwitchLiveSweep).toHaveBeenCalledOnce();
		expect(gamePass.runTwitchGamePass).toHaveBeenCalledOnce();
		expect(reconcile.runTwitchReconcileRecent).toHaveBeenCalledOnce();
		const sweepOpts = vi.mocked(sweep.runTwitchLiveSweep).mock.calls[0]?.[1];
		const reconcileOpts = vi.mocked(reconcile.runTwitchReconcileRecent).mock.calls[0]?.[1];
		expect(sweepOpts?.client).toBe(reconcileOpts?.client);
	});
});
