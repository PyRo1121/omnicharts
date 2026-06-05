import { markChannelsDormantWithoutRecentActivity } from '../db/channel-state';
import {
	computeFollowersDelta,
	fetchFollowerCountsByChannelId,
	fetchPriorFollowerSnapshots,
	storeFollowerSnapshots,
} from '../db/follower-snapshots';
import { runRetentionWithColdArchive } from '../db/cold-archive';
import { D1_BATCH_MAX_STATEMENTS } from '../db/d1-batch';
import { logD1BatchScope, logD1Meta } from '../db/d1-meta';
import { enrichFollowersBeforeRollup } from '../twitch/enrich-profiles';
import { requireDb } from '../worker-bindings';

export const DORMANT_INACTIVE_DAYS = 30;

import { aggregateSessionSamples, combineSessionMetrics, type ViewerSamplePoint } from './math';
import { utcDayEndExclusiveIso, utcDayStartIso, yesterdayUtcDateString } from './dates';

export type RollupDailyStats = {
	date: string;
	channelsProcessed: number;
	gameCategoriesProcessed: number;
	viewerSamplesPruned: number;
};

type SampleRow = {
	sampled_at: string;
	viewer_count: number;
	session_id: string;
	channel_id: string;
	game_category_id: string | null;
};

export function resolveRollupDate(explicit?: string): string {
	if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
	return yesterdayUtcDateString();
}

function rowsToPoints(rows: SampleRow[]): ViewerSamplePoint[] {
	return rows.map((r) => ({
		sampledAtMs: Date.parse(r.sampled_at),
		viewerCount: r.viewer_count,
	}));
}

async function fetchSamplesForDate(db: D1Database, date: string): Promise<SampleRow[]> {
	const dayStart = utcDayStartIso(date);
	const dayEndExclusive = utcDayEndExclusiveIso(date);
	const { results } = await db
		.prepare(
			`SELECT vs.sampled_at, vs.viewer_count, ss.id AS session_id,
              ss.channel_id, ss.game_category_id
       FROM viewer_samples vs
       INNER JOIN stream_sessions ss ON ss.id = vs.stream_session_id
       WHERE vs.sampled_at >= ? AND vs.sampled_at < ?
       ORDER BY vs.sampled_at ASC`,
		)
		.bind(dayStart, dayEndExclusive)
		.all<SampleRow>();

	return results ?? [];
}

export function prepareChannelDailyRollup(
	db: D1Database,
	channelId: string,
	date: string,
	metrics: ReturnType<typeof combineSessionMetrics>,
	followersDelta: number | null = null,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO channel_daily_rollups (
         channel_id, date, hours_watched, average_viewers, peak_viewers,
         airtime_minutes, stream_count, followers_delta
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel_id, date) DO UPDATE SET
         hours_watched = excluded.hours_watched,
         average_viewers = excluded.average_viewers,
         peak_viewers = excluded.peak_viewers,
         airtime_minutes = excluded.airtime_minutes,
         stream_count = excluded.stream_count,
         followers_delta = excluded.followers_delta`,
		)
		.bind(
			channelId,
			date,
			metrics.hoursWatched,
			metrics.averageViewers,
			metrics.peakViewers,
			metrics.airtimeMinutes,
			metrics.streamCount,
			followersDelta,
		);
}

export async function upsertChannelDailyRollup(
	db: D1Database,
	channelId: string,
	date: string,
	metrics: ReturnType<typeof combineSessionMetrics>,
	followersDelta: number | null = null,
): Promise<void> {
	await prepareChannelDailyRollup(db, channelId, date, metrics, followersDelta).run();
}

export function prepareGameDailyRollup(
	db: D1Database,
	gameCategoryId: string,
	date: string,
	metrics: {
		hoursWatched: number;
		averageViewers: number;
		peakViewers: number;
		airtimeMinutes: number;
		liveChannels: number;
	},
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO game_daily_rollups (
         game_category_id, date, hours_watched, average_viewers, peak_viewers,
         airtime_minutes, live_channels
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(game_category_id, date) DO UPDATE SET
         hours_watched = excluded.hours_watched,
         average_viewers = excluded.average_viewers,
         peak_viewers = excluded.peak_viewers,
         airtime_minutes = excluded.airtime_minutes,
         live_channels = excluded.live_channels`,
		)
		.bind(
			gameCategoryId,
			date,
			metrics.hoursWatched,
			metrics.averageViewers,
			metrics.peakViewers,
			metrics.airtimeMinutes,
			metrics.liveChannels,
		);
}

export async function upsertGameDailyRollup(
	db: D1Database,
	gameCategoryId: string,
	date: string,
	metrics: {
		hoursWatched: number;
		averageViewers: number;
		peakViewers: number;
		airtimeMinutes: number;
		liveChannels: number;
	},
): Promise<void> {
	await prepareGameDailyRollup(db, gameCategoryId, date, metrics).run();
}

/**
 * UTC daily rollup — docs/06-storage-and-rollup-design.md
 */
export async function runDailyRollup(env: Env, dateOverride?: string): Promise<RollupDailyStats> {
	const db = requireDb(env);
	const date = resolveRollupDate(dateOverride);
	await enrichFollowersBeforeRollup(env, date);
	const rows = await fetchSamplesForDate(db, date);

	const byChannelSession = new Map<string, SampleRow[]>();
	for (const row of rows) {
		const key = `${row.channel_id}:${row.session_id}`;
		const list = byChannelSession.get(key) ?? [];
		list.push(row);
		byChannelSession.set(key, list);
	}

	const channelSessions = new Map<string, ReturnType<typeof aggregateSessionSamples>[]>();
	for (const [key, sessionRows] of byChannelSession) {
		const channelId = key.split(':')[0]!;
		const metrics = aggregateSessionSamples(rowsToPoints(sessionRows));
		const list = channelSessions.get(channelId) ?? [];
		list.push(metrics);
		channelSessions.set(channelId, list);
	}

	const channelIds = [...channelSessions.keys()];
	const todayFollowers = await fetchFollowerCountsByChannelId(db, channelIds);
	const priorFollowers = await fetchPriorFollowerSnapshots(db, channelIds);
	const nextSnapshots = new Map<string, number>();

	const channelEntries = [...channelSessions.entries()];
	for (let i = 0; i < channelEntries.length; i += D1_BATCH_MAX_STATEMENTS) {
		const chunk = channelEntries.slice(i, i + D1_BATCH_MAX_STATEMENTS);
		const statements = chunk.map(([channelId, sessions]) => {
			const combined = combineSessionMetrics(sessions);
			const todayCount = todayFollowers.get(channelId) ?? null;
			const priorCount = priorFollowers.get(channelId) ?? null;
			const followersDelta = computeFollowersDelta(todayCount, priorCount);
			if (todayCount != null) nextSnapshots.set(channelId, todayCount);
			return prepareChannelDailyRollup(db, channelId, date, combined, followersDelta);
		});
		const batchResult = await db.batch(statements);
		logD1BatchScope('rollup:channel_daily', statements.length, env);
		for (const result of batchResult) {
			logD1Meta('rollup:channel_daily', result, env);
		}
	}

	await storeFollowerSnapshots(db, nextSnapshots);

	const gameSessions = new Map<string, ReturnType<typeof aggregateSessionSamples>[]>();
	const gameChannels = new Map<string, Set<string>>();

	for (const [key, sessionRows] of byChannelSession) {
		const gameId = sessionRows[0]?.game_category_id;
		if (!gameId) continue;
		const channelId = key.split(':')[0]!;
		const metrics = aggregateSessionSamples(rowsToPoints(sessionRows));
		const sessions = gameSessions.get(gameId) ?? [];
		sessions.push(metrics);
		gameSessions.set(gameId, sessions);
		const ch = gameChannels.get(gameId) ?? new Set<string>();
		ch.add(channelId);
		gameChannels.set(gameId, ch);
	}

	const gameEntries = [...gameSessions.entries()];
	for (let i = 0; i < gameEntries.length; i += D1_BATCH_MAX_STATEMENTS) {
		const chunk = gameEntries.slice(i, i + D1_BATCH_MAX_STATEMENTS);
		const statements = chunk.map(([gameId, sessions]) => {
			const combined = combineSessionMetrics(sessions);
			return prepareGameDailyRollup(db, gameId, date, {
				...combined,
				liveChannels: gameChannels.get(gameId)?.size ?? 0,
			});
		});
		const batchResult = await db.batch(statements);
		logD1BatchScope('rollup:game_daily', statements.length, env);
		for (const result of batchResult) {
			logD1Meta('rollup:game_daily', result, env);
		}
	}

	const metadataResult = await db
		.prepare(
			`INSERT INTO ingest_metadata (key, value) VALUES ('last_rollup_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		)
		.bind(new Date().toISOString())
		.run();

	logD1Meta('rollup:metadata', metadataResult, env);

	await markChannelsDormantWithoutRecentActivity(db, DORMANT_INACTIVE_DAYS);

	const retention = await runRetentionWithColdArchive(env);

	return {
		date,
		channelsProcessed: channelSessions.size,
		gameCategoriesProcessed: gameSessions.size,
		viewerSamplesPruned: retention.viewerSamplesPruned,
	};
}

export { queryTopChannelsByHoursWatched, queryTopGamesByAverageViewers, rankingQueryOptionsFromEnv } from '../ranking/rollup-queries';
