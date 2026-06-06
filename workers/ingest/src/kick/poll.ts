import { PLATFORM_KICK } from '@omnicharts/domain';
import {
	batchRecordKickLiveSamples,
	batchUpsertKickChannelsFromLivestreams,
	batchUpsertKickGameCategories,
	type KickLiveSampleInput,
} from '../db/kick-live-batch';
import { listKickChannelIdsToPoll } from '../db/kick';
import { runD1Batches } from '../db/d1-batch';
import { closeOpenSessionsForPlatformChannelIds } from '../db/session-lifecycle';
import { archiveSampleBatch } from '../r2/sample-archive';
import { ingestWarn } from '../log';
import { requireDb } from '../worker-bindings';
import { KickPublicApiClient } from './api';
import { kickCredentialsConfigured, kickMaxTrackedFromEnv, kickMinViewersFromEnv, KICK_LIVESTREAMS_BATCH_SIZE } from './config';
import { kickBroadcasterIdsReadyToClose } from './poll-offline-grace';
import { isKickViewerCountKnown, kickBroadcasterId } from './stream-fields';

export type KickPollResult = {
	batches: number;
	liveStreams: number;
	samplesWritten: number;
	skipped?: 'NEEDS_API';
};

export function kickPollNeedsApiReason(env: Env): string | null {
	if (!kickCredentialsConfigured(env)) {
		return 'KICK_CLIENT_ID and KICK_CLIENT_SECRET not configured';
	}
	return null;
}

/** Tracked-catalog poll — ≤50 broadcaster_user_id per Kick API batch (ADR-003). */
export async function runKickCatalogPoll(env: Env): Promise<KickPollResult> {
	const needsApi = kickPollNeedsApiReason(env);
	if (needsApi) {
		ingestWarn('[kick] poll skipped — NEEDS_API:', needsApi);
		return { batches: 0, liveStreams: 0, samplesWritten: 0, skipped: 'NEEDS_API' };
	}

	const db = requireDb(env);
	const limit = kickMaxTrackedFromEnv(env);
	const broadcasterIds = await listKickChannelIdsToPoll(db, limit);
	const totals: KickPollResult = { batches: 0, liveStreams: 0, samplesWritten: 0 };

	for (let i = 0; i < broadcasterIds.length; i += KICK_LIVESTREAMS_BATCH_SIZE) {
		const chunk = broadcasterIds.slice(i, i + KICK_LIVESTREAMS_BATCH_SIZE);
		const batch = await runKickPollBatch(env, chunk);
		totals.batches += batch.batches;
		totals.liveStreams += batch.liveStreams;
		totals.samplesWritten += batch.samplesWritten;
	}

	return totals;
}

export async function runKickPollBatch(env: Env, broadcasterIds: string[]): Promise<KickPollResult> {
	const db = requireDb(env);
	const client = new KickPublicApiClient(env);
	const minViewers = kickMinViewersFromEnv(env);
	const result: KickPollResult = {
		batches: 1,
		liveStreams: 0,
		samplesWritten: 0,
	};

	const liveStreams = await client.getLivestreamsByBroadcasterIds(broadcasterIds);
	result.liveStreams = liveStreams.length;

	const liveBroadcasterSet = new Set(liveStreams.map(kickBroadcasterId));
	const games = liveStreams
		.map((s) => s.category)
		.filter((c): c is NonNullable<typeof c> => c != null && Number.isFinite(c.id))
		.map((c) => ({ id: c.id, name: c.name?.trim() || 'Unknown' }));

	const gameMap = await batchUpsertKickGameCategories(
		db,
		games.map((g) => ({ id: g.id, name: g.name })),
	);
	const channelMap = await batchUpsertKickChannelsFromLivestreams(
		db,
		liveStreams,
		{ minViewers, promoteToTracked: true },
		{ env, scope: 'kick:poll:channels' },
	);

	const sampleInputs: KickLiveSampleInput[] = [];
	for (const stream of liveStreams) {
		if (!isKickViewerCountKnown(stream.viewer_count) || stream.viewer_count < minViewers) {
			continue;
		}
		const bid = kickBroadcasterId(stream);
		const channelId = channelMap.get(bid);
		if (!channelId) continue;
		const catId = stream.category?.id;
		sampleInputs.push({
			channelId,
			stream,
			gameCategoryId: catId != null ? (gameMap.get(String(catId)) ?? null) : null,
		});
	}

	const archiveRows = await batchRecordKickLiveSamples(db, sampleInputs, {
		env,
		scope: 'kick:poll:samples',
	});
	result.samplesWritten = archiveRows.length;
	await archiveSampleBatch(env, archiveRows);

	const now = new Date().toISOString();
	const offlineCandidates = broadcasterIds.filter((id) => !liveBroadcasterSet.has(id));
	const offlineIds = await kickBroadcasterIdsReadyToClose(db, broadcasterIds, liveBroadcasterSet);
	const offlineStatements = offlineCandidates.map((id) =>
		db.prepare(`UPDATE channels SET last_seen_at = ? WHERE platform_id = ? AND platform_channel_id = ?`).bind(now, PLATFORM_KICK, id),
	);
	await runD1Batches(db, offlineStatements, {
		env,
		scope: 'kick:poll:offline_last_seen',
	});
	await closeOpenSessionsForPlatformChannelIds(db, PLATFORM_KICK, offlineIds, now, {
		env,
		scope: 'kick:poll:offline_close_sessions',
	});

	return result;
}
