import { VOD_BACKFILL_STALE_DAYS, VOD_BACKFILL_VIDEOS_FIRST, vodBackfillMaxChannelsFromEnv } from './config';
import { TwitchHelixClient, type HelixVideo } from './helix';
import {
	batchUpsertVodSessions,
	helixVideoToVodSessionRow,
	listChannelsForVodBackfill,
	listChannelsForVodBackfillByPlatformIds,
	markChannelsVodBackfilled,
	type VodBackfillChannelRow,
} from '../db/vod-sessions';
import { filterHelixTwitchUserIds } from './platform-id';
import { hasTwitchAppCredentials } from './credentials';
import { requireDb } from '../worker-bindings';
import { isVideoWithinRetention, vodRetentionDaysForBroadcasterType, vodSessionTimes } from './vod-retention';

export type VodBackfillStats = {
	ok: boolean;
	skipped?: 'NEEDS_API';
	candidates: number;
	channels_processed: number;
	videos_fetched: number;
	sessions_upserted: number;
	pages: number;
};

export type VodBackfillOptions = {
	platformChannelIds?: string[];
	limit?: number;
};

function staleBeforeIso(): string {
	return new Date(Date.now() - VOD_BACKFILL_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function resolveBackfillChannels(db: D1Database, opts: VodBackfillOptions, maxChannels: number): Promise<VodBackfillChannelRow[]> {
	if (opts.platformChannelIds?.length) {
		const ids = filterHelixTwitchUserIds([...new Set(opts.platformChannelIds)]);
		return listChannelsForVodBackfillByPlatformIds(db, ids).then((rows) => rows.slice(0, maxChannels));
	}
	return listChannelsForVodBackfill(db, maxChannels, staleBeforeIso());
}

function filterVideosForChannel(videos: HelixVideo[], broadcasterType: string | null, nowMs: number): HelixVideo[] {
	const retentionDays = vodRetentionDaysForBroadcasterType(broadcasterType);
	return videos.filter((video) => isVideoWithinRetention(video.published_at || video.created_at, retentionDays, nowMs));
}

export async function fetchAllArchiveVideosForUser(
	client: TwitchHelixClient,
	userId: string,
	opts: { first?: number; maxPages?: number } = {},
): Promise<{ videos: HelixVideo[]; pages: number }> {
	const first = opts.first ?? VOD_BACKFILL_VIDEOS_FIRST;
	const maxPages = opts.maxPages ?? 20;
	const videos: HelixVideo[] = [];
	let after: string | undefined;
	let pages = 0;

	for (let page = 0; page < maxPages; page++) {
		const res = await client.getArchiveVideosPage(userId, { first, after });
		pages++;
		const batch = res.data ?? [];
		videos.push(...batch);
		after = res.pagination?.cursor;
		if (!after || batch.length === 0) break;
	}

	return { videos, pages };
}

export async function runTwitchVodBackfill(env: Env, opts: VodBackfillOptions = {}): Promise<VodBackfillStats> {
	const stats: VodBackfillStats = {
		ok: true,
		candidates: 0,
		channels_processed: 0,
		videos_fetched: 0,
		sessions_upserted: 0,
		pages: 0,
	};

	if (!hasTwitchAppCredentials(env)) {
		return { ...stats, ok: false, skipped: 'NEEDS_API' };
	}

	const db = requireDb(env);
	const maxChannels = opts.limit ?? vodBackfillMaxChannelsFromEnv(env);
	const channels = await resolveBackfillChannels(db, opts, maxChannels);
	stats.candidates = channels.length;
	if (channels.length === 0) return stats;

	const client = new TwitchHelixClient(env);
	const nowMs = Date.now();
	const processedChannelIds: string[] = [];

	for (const channel of channels) {
		const { videos, pages } = await fetchAllArchiveVideosForUser(client, channel.platform_channel_id);
		stats.pages += pages;
		stats.videos_fetched += videos.length;

		const inWindow = filterVideosForChannel(videos, channel.broadcaster_type, nowMs);
		const rows = inWindow.map((video) => helixVideoToVodSessionRow(channel.id, video, vodSessionTimes(video, nowMs)));
		stats.sessions_upserted += await batchUpsertVodSessions(db, rows);
		processedChannelIds.push(channel.id);
		stats.channels_processed++;
	}

	await markChannelsVodBackfilled(db, processedChannelIds);
	return stats;
}
