import { helixSafePointsPerMinuteFromEnv } from './helix-budget';
import { TwitchHelixClient } from './helix';
import { runTwitchGamePass } from './game-pass';
import { runTwitchReconcileRecent } from './reconcile';
import { runTwitchLiveSweep } from './sweep';
import type { IngestRunOpts } from '../db/d1-meta';

export type SweepAndGamePassStats = {
	global: Awaited<ReturnType<typeof runTwitchLiveSweep>>;
	gamePass: Awaited<ReturnType<typeof runTwitchGamePass>>;
};

export type TwitchCoverageQueuePassStats = SweepAndGamePassStats & {
	reconcile: Awaited<ReturnType<typeof runTwitchReconcileRecent>>;
};

/**
 * Global sweep + rotating game pass in one queue consumer — shared Helix client and
 * `seenUserIds` dedup (legacy `poll_twitch_sweep` body).
 */
export async function runTwitchSweepAndGamePass(env: Env, runOpts?: IngestRunOpts): Promise<SweepAndGamePassStats> {
	const client = new TwitchHelixClient(env, {
		budgetPoints: helixSafePointsPerMinuteFromEnv(env),
	});
	const seenUserIds = new Set<string>();
	const passOpts = { client, seenUserIds, runOpts };
	const global = await runTwitchLiveSweep(env, passOpts);
	const gamePass = await runTwitchGamePass(env, passOpts);
	return { global, gamePass };
}

/**
 * Full minute coverage in one queue consumer — sweep, game pass, reconcile sequential.
 * Profile enrichment runs on the 6h discover cron (`poll_twitch_enrich`), not here.
 */
export async function runTwitchCoverageQueuePass(env: Env, runOpts?: IngestRunOpts): Promise<TwitchCoverageQueuePassStats> {
	const client = new TwitchHelixClient(env, {
		budgetPoints: helixSafePointsPerMinuteFromEnv(env),
	});
	const seenUserIds = new Set<string>();
	const passOpts = { client, seenUserIds, runOpts };
	const global = await runTwitchLiveSweep(env, passOpts);
	const gamePass = await runTwitchGamePass(env, passOpts);
	const reconcile = await runTwitchReconcileRecent(env, { client, runOpts });
	return { global, gamePass, reconcile };
}
