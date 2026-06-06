import { helixSafePointsPerMinuteFromEnv } from './helix-budget';
import { TwitchHelixClient } from './helix';
import { runTwitchGamePass } from './game-pass';
import { runTwitchReconcileRecent } from './reconcile';
import { runTwitchLiveSweep } from './sweep';

export type CoverageCycleStats = {
	global: Awaited<ReturnType<typeof runTwitchLiveSweep>>;
	gamePass: Awaited<ReturnType<typeof runTwitchGamePass>>;
	reconcile: Awaited<ReturnType<typeof runTwitchReconcileRecent>>;
	helixPointsUsed: number;
};

/**
 * Full Twitch live ingest cycle — mitigates Helix pagination drift (see ADR-0006).
 * Admin / legacy `poll_platform` inline path. Profile enrichment runs on discover cron.
 */
export async function runTwitchCoverageCycle(env: Env): Promise<CoverageCycleStats> {
	const client = new TwitchHelixClient(env, {
		budgetPoints: helixSafePointsPerMinuteFromEnv(env),
	});
	const seenUserIds = new Set<string>();
	const passOpts = { client, seenUserIds };

	const global = await runTwitchLiveSweep(env, passOpts);
	const gamePass = await runTwitchGamePass(env, passOpts);
	const reconcile = await runTwitchReconcileRecent(env, { client });

	return {
		global,
		gamePass,
		reconcile,
		helixPointsUsed: global.pagesFetched + gamePass.pagesFetched + gamePass.topGamesHelixPoints + reconcile.batches,
	};
}
