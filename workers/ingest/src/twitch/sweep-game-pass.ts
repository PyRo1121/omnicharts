import { helixSafePointsPerMinuteFromEnv } from './helix-budget';
import { TwitchHelixClient } from './helix';
import { runTwitchGamePass } from './game-pass';
import { runTwitchLiveSweep } from './sweep';

export type SweepAndGamePassStats = {
	global: Awaited<ReturnType<typeof runTwitchLiveSweep>>;
	gamePass: Awaited<ReturnType<typeof runTwitchGamePass>>;
};

/**
 * Global sweep + rotating game pass in one queue consumer — shared Helix client and
 * `seenUserIds` dedup (production `INGEST_COVERAGE_MODE=full` fan-out).
 */
export async function runTwitchSweepAndGamePass(env: Env): Promise<SweepAndGamePassStats> {
	const client = new TwitchHelixClient(env, {
		budgetPoints: helixSafePointsPerMinuteFromEnv(env),
	});
	const seenUserIds = new Set<string>();
	const passOpts = { client, seenUserIds };
	const global = await runTwitchLiveSweep(env, passOpts);
	const gamePass = await runTwitchGamePass(env, passOpts);
	return { global, gamePass };
}
