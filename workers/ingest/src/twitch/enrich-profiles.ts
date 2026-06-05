import {
	ENRICH_BEFORE_ROLLUP_MAX_CHANNELS,
	ENRICH_MAX_CHANNELS_PER_RUN,
	ENRICH_STALE_HOURS,
	STREAMS_BATCH_SIZE
} from './config';
import { TwitchHelixClient } from './helix';
import { mergeUserAndChannelProfile } from './profile-fields';
import { batchMarkChannelsRetired } from '../db/channel-state';
import { deleteEventSubForRetiredChannels } from './eventsub/retire-cleanup';
import {
	batchApplyChannelProfileEnrichment,
	listPlatformIdsForProfileEnrichment,
	listPlatformIdsForRollupDate
} from '../db/twitch';
import { filterHelixTwitchUserIds } from './platform-id';
import { hasTwitchAppCredentials } from './credentials';
import { requireDb } from '../worker-bindings';

export type ProfileEnrichmentStats = {
	candidates: number;
	userBatches: number;
	channelBatches: number;
	updated: number;
	skipped: number;
	retired: number;
};

/**
 * Refresh follower totals for channels with samples on the rollup date (capped).
 * Runs at start of `runDailyRollup` so `followers_delta` uses fresh Helix totals.
 */
export async function enrichFollowersBeforeRollup(env: Env, rollupDate: string): Promise<void> {
	if (!hasTwitchAppCredentials(env)) return;

	const db = requireDb(env);
	const ids = await listPlatformIdsForRollupDate(
		db,
		rollupDate,
		ENRICH_BEFORE_ROLLUP_MAX_CHANNELS
	);
	if (ids.length === 0) return;

	await runTwitchProfileEnrichment(env, {
		platformChannelIds: ids.slice(0, ENRICH_BEFORE_ROLLUP_MAX_CHANNELS)
	});
}

/**
 * Tier B Helix profile enrichment — GET /users + GET /channels (batched ×100).
 * When `platformChannelIds` omitted, refreshes tracked channels stale vs `profile_enriched_at`.
 */
export async function runTwitchProfileEnrichment(
	env: Env,
	opts: { platformChannelIds?: string[]; includeFollowers?: boolean } = {}
): Promise<ProfileEnrichmentStats> {
	const client = new TwitchHelixClient(env);
	const db = requireDb(env);
	const stats: ProfileEnrichmentStats = {
		candidates: 0,
		userBatches: 0,
		channelBatches: 0,
		updated: 0,
		skipped: 0,
		retired: 0
	};

	const rawIds =
		opts.platformChannelIds?.length
			? [...new Set(opts.platformChannelIds)]
			: await listPlatformIdsForProfileEnrichment(
					db,
					ENRICH_MAX_CHANNELS_PER_RUN,
					ENRICH_STALE_HOURS
				);

	const includeFollowers = opts.includeFollowers !== false;
	const ids = filterHelixTwitchUserIds(rawIds);
	stats.skipped = rawIds.length - ids.length;
	stats.candidates = ids.length;
	if (ids.length === 0) return stats;

	for (let i = 0; i < ids.length; i += STREAMS_BATCH_SIZE) {
		const batch = ids.slice(i, i + STREAMS_BATCH_SIZE);
		stats.userBatches++;
		const users = await client.getUsersByIds(batch);
		const userById = new Map(users.map((u) => [u.id, u]));

		stats.channelBatches++;
		const channels = await client.getChannelsByBroadcasterIds(batch);
		const channelById = new Map(channels.map((c) => [c.broadcaster_id, c]));

		const followerTotals = includeFollowers
			? await client.getChannelFollowerTotals(batch)
			: new Map<string, number>();

		const toUpdate: ReturnType<typeof mergeUserAndChannelProfile>[] = [];
		const toRetire: string[] = [];
		for (const platformId of batch) {
			const user = userById.get(platformId);
			if (!user) {
				toRetire.push(platformId);
				continue;
			}
			toUpdate.push(
				mergeUserAndChannelProfile(
					user,
					channelById.get(platformId),
					followerTotals.get(platformId) ?? null
				)
			);
		}
		if (toRetire.length > 0) {
			stats.retired += await batchMarkChannelsRetired(db, toRetire);
			await deleteEventSubForRetiredChannels(env, toRetire);
		}
		await batchApplyChannelProfileEnrichment(db, toUpdate);
		stats.updated += toUpdate.length;
	}

	return stats;
}
