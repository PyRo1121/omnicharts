import {
	batchUpsertKickChannelsFromLivestreams,
	batchUpsertKickGameCategories
} from '../db/kick-live-batch';
import { ingestWarn } from '../log';
import { requireDb } from '../worker-bindings';
import { KickPublicApiClient } from './api';
import {
	DISCOVERY_CATEGORIES_TO_SCAN,
	DISCOVERY_CATEGORY_LIST_LIMIT,
	DISCOVERY_CATEGORY_LIVESTREAMS_LIMIT,
	kickCredentialsConfigured,
	kickMinViewersFromEnv
} from './config';
import { kickBroadcasterId } from './stream-fields';

export type KickDiscoveryStats = {
	categoriesScanned: number;
	categoryListPagesFetched: number;
	streamsSeen: number;
	channelsUpserted: number;
};

export type KickDiscoveryOptions = {
	/** Fewer categories — admin/checkpoint shortcut */
	quick?: boolean;
};

export function kickDiscoveryNeedsApiReason(env: Env): string | null {
	if (!kickCredentialsConfigured(env)) {
		return 'KICK_CLIENT_ID and KICK_CLIENT_SECRET not configured';
	}
	return null;
}

/**
 * Category leaderboard discovery (every 6h) — docs/12 Kick discovery.
 * GET /public/v2/categories → GET /public/v1/livestreams?category_id&sort=viewer_count&limit=100.
 * Metadata only (`discovered` / directory promotion); samples come from poll_kick_tracked.
 */
export async function runKickDiscovery(
	env: Env,
	opts: KickDiscoveryOptions = {}
): Promise<KickDiscoveryStats> {
	const needsApi = kickDiscoveryNeedsApiReason(env);
	if (needsApi) {
		ingestWarn('[kick] discover skipped — NEEDS_API:', needsApi);
		return {
			categoriesScanned: 0,
			categoryListPagesFetched: 0,
			streamsSeen: 0,
			channelsUpserted: 0
		};
	}

	const db = requireDb(env);
	const client = new KickPublicApiClient(env);
	const minViewers = kickMinViewersFromEnv(env);
	const categoriesToScan = opts.quick ? 3 : DISCOVERY_CATEGORIES_TO_SCAN;

	const stats: KickDiscoveryStats = {
		categoriesScanned: 0,
		categoryListPagesFetched: 0,
		streamsSeen: 0,
		channelsUpserted: 0
	};

	const categories: { id: number; name: string }[] = [];
	let cursor: string | undefined;

	while (categories.length < categoriesToScan) {
		const page = await client.getCategoriesV2({
			cursor,
			limit: DISCOVERY_CATEGORY_LIST_LIMIT
		});
		stats.categoryListPagesFetched++;

		for (const cat of page.data ?? []) {
			if (!Number.isFinite(cat.id)) continue;
			categories.push({ id: cat.id, name: cat.name?.trim() || 'Unknown' });
			if (categories.length >= categoriesToScan) break;
		}

		cursor = page.pagination?.next_cursor;
		if (!cursor || (page.data?.length ?? 0) === 0) break;
	}

	const seenBroadcasters = new Set<string>();

	for (const category of categories.slice(0, categoriesToScan)) {
		stats.categoriesScanned++;

		const liveStreams = await client.getLivestreamsByCategoryId(category.id, {
			limit: DISCOVERY_CATEGORY_LIVESTREAMS_LIMIT,
			sort: 'viewer_count'
		});

		stats.streamsSeen += liveStreams.length;

		await batchUpsertKickGameCategories(db, [{ id: category.id, name: category.name }]);

		await batchUpsertKickChannelsFromLivestreams(
			db,
			liveStreams,
			{ minViewers, promoteToTracked: true, directoryListing: true },
			{ env, scope: 'kick:discover:channels' }
		);

		for (const stream of liveStreams) {
			seenBroadcasters.add(kickBroadcasterId(stream));
		}
	}

	stats.channelsUpserted = seenBroadcasters.size;
	return stats;
}
