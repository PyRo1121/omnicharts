import { PLATFORM_TWITCH } from '@omnicharts/domain';
import { utcDayEndExclusiveIso, utcDayStartIso } from '../rollup/dates';
import { slugify } from '../twitch/slug';
import type { HelixGame, HelixStream } from '../twitch/helix';
import type { ChannelProfileEnrichmentRow } from '../twitch/profile-fields';
import type { SampleArchiveRow } from '../r2/sample-archive';
import {
	batchRecordLiveSamples,
	batchUpsertChannelsFromStreams,
	batchUpsertGameCategories
} from './twitch-live-batch';
import { runD1Batches } from './d1-batch';

export {
	batchRecordLiveSamples,
	batchUpsertChannelsFromStreams,
	batchUpsertGameCategories
} from './twitch-live-batch';
export type { LiveSampleInput } from './twitch-live-batch';

const nowIso = () => new Date().toISOString();

/** Shared WHERE for tracked Helix broadcaster rows (numeric IDs, no dev fixtures). */
const TRACKED_TWITCH_CHANNEL_SQL = `
  platform_id = ?
  AND ingest_state = 'tracked'
  AND platform_channel_id GLOB '[0-9]*'
  AND platform_channel_id NOT GLOB 'dev-*'
  AND id NOT LIKE 'dev-seed-ch-%'`;


export async function upsertGameCategory(
	db: D1Database,
	game: Pick<HelixGame, 'id' | 'name'>
): Promise<string> {
	const map = await batchUpsertGameCategories(db, [game]);
	const id = map.get(game.id);
	if (!id) {
		const slug = slugify(game.name) || `game-${game.id}`;
		return `twitch-game-${game.id}`;
	}
	return id;
}

export async function upsertChannelFromStream(
	db: D1Database,
	stream: HelixStream,
	opts: { minViewers: number; promoteToTracked: boolean }
): Promise<string> {
	const map = await batchUpsertChannelsFromStreams(db, [stream], opts);
	const channelId = map.get(stream.user_id);
	if (!channelId) {
		return `twitch-ch-${stream.user_id}`;
	}
	return channelId;
}

/** Recently active tracked channels — for Helix reconcile-by-id pass. */
export async function listRecentlyTrackedPlatformIds(
	db: D1Database,
	withinHours: number,
	limit: number
): Promise<string[]> {
	const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();

	const { results } = await db
		.prepare(
			`SELECT platform_channel_id FROM channels
       WHERE ${TRACKED_TWITCH_CHANNEL_SQL}
         AND last_seen_at >= ?
       ORDER BY last_seen_at DESC
       LIMIT ?`
		)
		.bind(PLATFORM_TWITCH, since, limit)
		.all<{ platform_channel_id: string }>();

	return (results ?? []).map((r) => r.platform_channel_id);
}

export async function listChannelIdsToPoll(
	db: D1Database,
	limit: number
): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT platform_channel_id FROM channels
       WHERE ${TRACKED_TWITCH_CHANNEL_SQL}
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT ?`
		)
		.bind(PLATFORM_TWITCH, limit)
		.all<{ platform_channel_id: string }>();

	return (results ?? []).map((r) => r.platform_channel_id);
}

export async function recordLiveSample(
	db: D1Database,
	channelId: string,
	stream: HelixStream,
	gameCategoryId: string | null
): Promise<SampleArchiveRow> {
	const rows = await batchRecordLiveSamples(db, [{ channelId, stream, gameCategoryId }]);
	return rows[0]!;
}

export type DiscoveryStats = {
	gamesScanned: number;
	pagesFetched: number;
	streamsSeen: number;
	channelsUpserted: number;
};

/** Tracked channels needing Tier B refresh (null or stale `profile_enriched_at`). */
/** Tracked Twitch broadcasters with viewer samples on a rollup UTC date (for pre-rollup follower refresh). */
export async function listPlatformIdsForRollupDate(
	db: D1Database,
	rollupDate: string,
	limit: number
): Promise<string[]> {
	const dayStart = utcDayStartIso(rollupDate);
	const dayEndExclusive = utcDayEndExclusiveIso(rollupDate);
	const { results } = await db
		.prepare(
			`SELECT c.platform_channel_id
       FROM viewer_samples vs
       INNER JOIN stream_sessions ss ON ss.id = vs.stream_session_id
       INNER JOIN channels c ON c.id = ss.channel_id
       WHERE c.platform_id = ?
         AND c.ingest_state = 'tracked'
         AND c.platform_channel_id GLOB '[0-9]*'
         AND c.platform_channel_id NOT GLOB 'dev-*'
         AND vs.sampled_at >= ? AND vs.sampled_at < ?
       GROUP BY c.platform_channel_id
       ORDER BY MAX(c.last_seen_at) DESC
       LIMIT ?`
		)
		.bind(PLATFORM_TWITCH, dayStart, dayEndExclusive, limit)
		.all<{ platform_channel_id: string }>();

	return (results ?? []).map((r) => r.platform_channel_id);
}

export async function listPlatformIdsForProfileEnrichment(
	db: D1Database,
	limit: number,
	staleHours: number
): Promise<string[]> {
	const staleBefore = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();

	const { results } = await db
		.prepare(
			`SELECT platform_channel_id FROM channels
       WHERE ${TRACKED_TWITCH_CHANNEL_SQL}
         AND (profile_enriched_at IS NULL OR profile_enriched_at < ?)
       ORDER BY profile_enriched_at ASC NULLS FIRST, last_seen_at DESC
       LIMIT ?`
		)
		.bind(PLATFORM_TWITCH, staleBefore, limit)
		.all<{ platform_channel_id: string }>();

	return (results ?? []).map((r) => r.platform_channel_id);
}

function prepareChannelProfileUpdate(db: D1Database, row: ChannelProfileEnrichmentRow, now: string) {
	return db
		.prepare(
			`UPDATE channels SET
         display_name = ?,
         avatar_url = ?,
         description = ?,
         broadcaster_type = ?,
         platform_created_at = ?,
         channel_profile_json = ?,
         profile_enriched_at = ?,
         follower_count = COALESCE(?, follower_count),
         followers_enriched_at = CASE WHEN ? IS NOT NULL THEN ? ELSE followers_enriched_at END
       WHERE platform_id = ? AND platform_channel_id = ?`
		)
		.bind(
			row.display_name,
			row.avatar_url,
			row.description,
			row.broadcaster_type,
			row.platform_created_at,
			row.channel_profile_json,
			now,
			row.follower_count ?? null,
			row.follower_count ?? null,
			row.follower_count != null ? now : null,
			PLATFORM_TWITCH,
			row.platform_channel_id
		);
}

export async function applyChannelProfileEnrichment(
	db: D1Database,
	row: ChannelProfileEnrichmentRow
): Promise<void> {
	await prepareChannelProfileUpdate(db, row, nowIso()).run();
}

/** Batch profile UPDATEs (≤50 per D1 `batch()`). */
export async function batchApplyChannelProfileEnrichment(
	db: D1Database,
	rows: ChannelProfileEnrichmentRow[]
): Promise<void> {
	if (rows.length === 0) return;
	const now = nowIso();
	const statements = rows.map((row) => prepareChannelProfileUpdate(db, row, now));
	await runD1Batches(db, statements, { scope: 'profile:enrichment' });
}
