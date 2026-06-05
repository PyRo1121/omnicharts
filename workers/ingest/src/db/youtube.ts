import { PLATFORM_YOUTUBE } from '@omnicharts/domain';

/** Shared WHERE for tracked YouTube channel rows with a known live video id. */
const TRACKED_YOUTUBE_POLL_SQL = `
  platform_id = ?
  AND ingest_state = 'tracked'
  AND youtube_live_video_id IS NOT NULL
  AND youtube_live_video_id != ''
  AND platform_channel_id GLOB 'UC*'
  AND platform_channel_id NOT GLOB 'dev-*'
  AND id NOT LIKE 'dev-seed-ch-%'`;

export type YoutubePollTarget = {
	channelRowId: string;
	platformChannelId: string;
	liveVideoId: string;
};

export async function listYoutubePollTargets(
	db: D1Database,
	limit: number
): Promise<YoutubePollTarget[]> {
	const { results } = await db
		.prepare(
			`SELECT id, platform_channel_id, youtube_live_video_id
       FROM channels
       WHERE ${TRACKED_YOUTUBE_POLL_SQL}
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT ?`
		)
		.bind(PLATFORM_YOUTUBE, limit)
		.all<{
			id: string;
			platform_channel_id: string;
			youtube_live_video_id: string;
		}>();

	return (results ?? []).map((row) => ({
		channelRowId: row.id,
		platformChannelId: row.platform_channel_id,
		liveVideoId: row.youtube_live_video_id
	}));
}

const TRACKED_YOUTUBE_UC_SQL = `
  platform_id = ?
  AND ingest_state = 'tracked'
  AND platform_channel_id GLOB 'UC*'
  AND platform_channel_id NOT GLOB 'dev-*'
  AND id NOT LIKE 'dev-seed-ch-%'`;

export type YoutubeTrackedChannel = {
	channelRowId: string;
	platformChannelId: string;
};

/** Tracked UC channels missing a live video id (poll bootstrap / refresh). */
export async function listYoutubeTrackedMissingLiveVideoId(
	db: D1Database,
	limit: number
): Promise<YoutubeTrackedChannel[]> {
	const { results } = await db
		.prepare(
			`SELECT id, platform_channel_id
       FROM channels
       WHERE ${TRACKED_YOUTUBE_UC_SQL}
         AND (youtube_live_video_id IS NULL OR youtube_live_video_id = '')
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT ?`
		)
		.bind(PLATFORM_YOUTUBE, limit)
		.all<{ id: string; platform_channel_id: string }>();

	return (results ?? []).map((row) => ({
		channelRowId: row.id,
		platformChannelId: row.platform_channel_id
	}));
}

export async function setYoutubeLiveVideoId(
	db: D1Database,
	channelRowId: string,
	liveVideoId: string | null
): Promise<void> {
	await db
		.prepare(`UPDATE channels SET youtube_live_video_id = ? WHERE id = ? AND platform_id = ?`)
		.bind(liveVideoId, channelRowId, PLATFORM_YOUTUBE)
		.run();
}
