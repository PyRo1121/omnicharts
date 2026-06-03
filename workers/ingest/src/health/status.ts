import { TWITCH_PLATFORM_ID } from '../twitch/config';
import { DISCOVERY_SEED_KEY } from '../discovery/seed';
import type { PlatformIngestCounts } from './ingest-counts';
import {
	fetchIngestOperationalMetrics,
	healthStatusFromLag,
	ingestLagSecondsFromMaxSample,
	type IngestOperationalMetrics
} from './operational-metrics';

/** Public GET /health — enough for checkpoint + homepage overview (no state breakdown). */
export type PublicHealthPayload = {
	status: 'ok' | 'degraded' | 'unavailable';
	service: string;
	db: 'connected' | 'unavailable';
	twitch: 'configured' | 'missing_credentials';
	tracked_channels: { twitch: number };
	channels_live: number;
	timestamp: string;
};

export type IngestHealthPayload = PublicHealthPayload & {
	last_rollup_at: string | null;
	discovery_seed_at: string | null;
	ingest_state_counts: PlatformIngestCounts;
	discovery_new_24h: number;
	ingest_lag_seconds: IngestOperationalMetrics['ingest_lag_seconds'];
};

function countFromBatchRow(batchEntry: D1Result): number {
	const row = batchEntry.results?.[0] as { n?: number } | undefined;
	return row?.n ?? 0;
}

function maxSampleFromBatchRow(batchEntry: D1Result): string | null {
	const row = batchEntry.results?.[0] as { max_sampled_at?: string | null } | undefined;
	return row?.max_sampled_at ?? null;
}

export async function buildPublicHealth(env: Env): Promise<PublicHealthPayload> {
	const twitchConfigured = Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
	let dbConnected = false;
	let twitchTracked = 0;
	let channelsLive = 0;
	let twitchLag: number | null = null;

	try {
		const [pingBatch, trackedBatch, liveBatch, sampleBatch] = await env.DB.batch([
			env.DB.prepare('SELECT 1 AS ok'),
			env.DB.prepare(
				`SELECT COUNT(*) AS n FROM channels WHERE platform_id = ? AND ingest_state = 'tracked'`
			).bind(TWITCH_PLATFORM_ID),
			env.DB.prepare(
				`SELECT COUNT(*) AS n FROM stream_sessions ss
       INNER JOIN channels c ON c.id = ss.channel_id
       WHERE c.platform_id = ? AND ss.ended_at IS NULL`
			).bind(TWITCH_PLATFORM_ID),
			env.DB.prepare(
				`SELECT MAX(vs.sampled_at) AS max_sampled_at
       FROM viewer_samples vs
       INNER JOIN stream_sessions ss ON ss.id = vs.stream_session_id
       INNER JOIN channels c ON c.id = ss.channel_id
       WHERE c.platform_id = ?`
			).bind(TWITCH_PLATFORM_ID)
		]);
		if (!pingBatch.results?.length) throw new Error('db ping failed');
		dbConnected = true;
		twitchTracked = countFromBatchRow(trackedBatch);
		channelsLive = countFromBatchRow(liveBatch);
		twitchLag = ingestLagSecondsFromMaxSample(maxSampleFromBatchRow(sampleBatch));
	} catch {
		dbConnected = false;
	}

	const baseStatus = !dbConnected || !twitchConfigured ? 'unavailable' : 'ok';
	const status = healthStatusFromLag(baseStatus, twitchLag);

	return {
		status,
		service: 'omnicharts-ingest',
		db: dbConnected ? 'connected' : 'unavailable',
		twitch: twitchConfigured ? 'configured' : 'missing_credentials',
		tracked_channels: { twitch: twitchTracked },
		channels_live: channelsLive,
		timestamp: new Date().toISOString()
	};
}

function parseDiscoverySeedAt(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as { at?: string };
		return parsed.at ?? value;
	} catch {
		return value;
	}
}

function ingestStateCountsFromBatch(batchEntry: D1Result): PlatformIngestCounts {
	const empty = { discovered: 0, tracked: 0, dormant: 0, retired: 0 };
	const twitch = { ...empty };
	for (const row of batchEntry.results ?? []) {
		const typed = row as { ingest_state: string; n: number };
		if (typed.ingest_state in twitch) {
			twitch[typed.ingest_state as keyof typeof empty] = typed.n;
		}
	}
	return { twitch };
}

export async function buildIngestHealth(env: Env): Promise<IngestHealthPayload> {
	const twitchConfigured = Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
	let dbConnected = false;
	let lastRollupAt: string | null = null;
	let twitchTracked = 0;
	let ingestStateCounts: PlatformIngestCounts = {
		twitch: { discovered: 0, tracked: 0, dormant: 0, retired: 0 }
	};
	let discoverySeedAt: string | null = null;
	let channelsLive = 0;
	let discoveryNew24h = 0;
	let ingestLagSeconds: IngestOperationalMetrics['ingest_lag_seconds'] = { twitch: null };

	try {
		const [batchResults, ops] = await Promise.all([
			env.DB.batch([
				env.DB.prepare('SELECT 1 AS ok'),
				env.DB.prepare(
					`SELECT value FROM ingest_metadata WHERE key = 'last_rollup_at'`
				),
				env.DB.prepare(
					`SELECT ingest_state, COUNT(*) AS n FROM channels
         WHERE platform_id = ?
         GROUP BY ingest_state`
				).bind(TWITCH_PLATFORM_ID),
				env.DB.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`).bind(
					DISCOVERY_SEED_KEY
				)
			]),
			fetchIngestOperationalMetrics(env.DB)
		]);
		if (!batchResults[0]?.results?.length) throw new Error('db ping failed');
		dbConnected = true;

		const rollupRow = batchResults[1]?.results?.[0] as { value?: string } | undefined;
		lastRollupAt = rollupRow?.value ?? null;
		ingestStateCounts = ingestStateCountsFromBatch(batchResults[2]!);
		twitchTracked = ingestStateCounts.twitch.tracked;
		const seedRow = batchResults[3]?.results?.[0] as { value?: string } | undefined;
		discoverySeedAt = parseDiscoverySeedAt(seedRow?.value);

		channelsLive = ops.channels_live;
		discoveryNew24h = ops.discovery_new_24h;
		ingestLagSeconds = ops.ingest_lag_seconds;
	} catch {
		dbConnected = false;
	}

	const baseStatus = !dbConnected || !twitchConfigured ? 'unavailable' : 'ok';
	const status = healthStatusFromLag(baseStatus, ingestLagSeconds.twitch);

	return {
		status,
		service: 'omnicharts-ingest',
		db: dbConnected ? 'connected' : 'unavailable',
		twitch: twitchConfigured ? 'configured' : 'missing_credentials',
		tracked_channels: { twitch: twitchTracked },
		channels_live: channelsLive,
		timestamp: new Date().toISOString(),
		last_rollup_at: lastRollupAt,
		discovery_seed_at: discoverySeedAt,
		ingest_state_counts: ingestStateCounts,
		discovery_new_24h: discoveryNew24h,
		ingest_lag_seconds: ingestLagSeconds
	};
}

export function ingestHealthHttpStatus(
	payload: Pick<PublicHealthPayload, 'status'>
): number {
	if (payload.status === 'unavailable') return 503;
	return 200;
}
