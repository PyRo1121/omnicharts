import { ENRICH_MAX_CHANNELS_PER_RUN } from './config';
import { helixSafePointsPerMinuteFromEnv } from './helix-budget';
import { runTwitchProfileEnrichment } from './enrich-profiles';
import { TwitchHelixClient } from './helix';
import { runTwitchGamePass } from './game-pass';
import { runTwitchReconcileRecent } from './reconcile';
import { ingestNonFatalError } from '../log';
import { runTwitchLiveSweep } from './sweep';

export type CoverageCycleStats = {
	global: Awaited<ReturnType<typeof runTwitchLiveSweep>>;
	gamePass: Awaited<ReturnType<typeof runTwitchGamePass>>;
	reconcile: Awaited<ReturnType<typeof runTwitchReconcileRecent>>;
	profileEnrichment: Awaited<ReturnType<typeof runTwitchProfileEnrichment>>;
	helixPointsUsed: number;
};

/**
 * Full Twitch live ingest cycle — mitigates Helix pagination drift (see ADR-0006).
 * 1. Global directory sweep
 * 2. Rotating game-id sweeps (union, deduped in-process)
 * 3. Reconcile recently tracked IDs by user_id
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

	const enrichIds = reconcile.platformChannelIds.slice(0, ENRICH_MAX_CHANNELS_PER_RUN);
	let profileEnrichment: Awaited<ReturnType<typeof runTwitchProfileEnrichment>> = {
		candidates: 0,
		userBatches: 0,
		channelBatches: 0,
		updated: 0,
		skipped: 0,
		retired: 0,
	};
	try {
		profileEnrichment = await runTwitchProfileEnrichment(env, {
			platformChannelIds: enrichIds.length > 0 ? enrichIds : undefined,
			includeFollowers: false,
		});
	} catch (err) {
		ingestNonFatalError('coverage profile enrichment failed (non-fatal)', err);
	}

	const enrichPoints = profileEnrichment.userBatches + profileEnrichment.channelBatches;

	return {
		global,
		gamePass,
		reconcile,
		profileEnrichment,
		helixPointsUsed: global.pagesFetched + gamePass.pagesFetched + gamePass.topGamesHelixPoints + reconcile.batches + enrichPoints,
	};
}
