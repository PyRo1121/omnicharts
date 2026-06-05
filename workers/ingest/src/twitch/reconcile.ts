import {
	minViewersFromEnv,
	RECONCILE_MAX_CHANNELS,
	RECONCILE_RECENT_HOURS,
	STREAMS_BATCH_SIZE
} from './config';
import { TwitchHelixClient } from './helix';
import { listRecentlyTrackedPlatformIds } from '../db/twitch';
import { closeOpenSessionsForPlatformChannelIds } from '../db/session-lifecycle';
import { ingestHelixStreamsBatch } from './ingest-stream';
import { helixBudgetAllowsFetch, helixBudgetReconcileBatches } from './rate-limit';
import { requireDb } from '../worker-bindings';

export type ReconcileStats = {
	candidates: number;
	platformChannelIds: string[];
	batches: number;
	liveFound: number;
	samplesWritten: number;
	retired: number;
};

export type ReconcileOptions = {
	/** Shared client for sequential coverage (one budget across sweep + game pass + reconcile). */
	client?: TwitchHelixClient;
};

/**
 * Direct GET /streams?user_id=… for recently tracked channels.
 * Authoritative per-ID lookup; catches streams dropped from paginated directory sweeps.
 */
export async function runTwitchReconcileRecent(
	env: Env,
	opts: ReconcileOptions = {}
): Promise<ReconcileStats> {
	const db = requireDb(env);
	const client = opts.client ?? new TwitchHelixClient(env);
	const minViewers = minViewersFromEnv(env);
	const stats: ReconcileStats = {
		candidates: 0,
		platformChannelIds: [],
		batches: 0,
		liveFound: 0,
		samplesWritten: 0,
		retired: 0
	};

	const userIds = await listRecentlyTrackedPlatformIds(
		db,
		RECONCILE_RECENT_HOURS,
		RECONCILE_MAX_CHANNELS
	);
	stats.candidates = userIds.length;
	stats.platformChannelIds = userIds;
	if (userIds.length === 0) return stats;

	const configuredBatches = Math.ceil(userIds.length / STREAMS_BATCH_SIZE);
	const batchLimit = helixBudgetReconcileBatches(client.getBudget(), configuredBatches);

	for (let b = 0; b < batchLimit; b++) {
		if (!helixBudgetAllowsFetch(client.getBudget())) break;

		const batch = userIds.slice(b * STREAMS_BATCH_SIZE, (b + 1) * STREAMS_BATCH_SIZE);
		stats.batches++;
		const liveStreams = await client.getStreamsByUserIds(batch);
		const liveSet = new Set(liveStreams.map((s) => s.user_id));
		const offlineIds = batch.filter((uid) => !liveSet.has(uid));
		const now = new Date().toISOString();

		stats.liveFound += liveStreams.length;
		const archiveRows = await ingestHelixStreamsBatch(env, liveStreams, minViewers);
		stats.samplesWritten += archiveRows.length;
		await closeOpenSessionsForPlatformChannelIds(db, offlineIds, now, {
			env,
			scope: 'reconcile:offline_close_sessions'
		});
	}

	return stats;
}
