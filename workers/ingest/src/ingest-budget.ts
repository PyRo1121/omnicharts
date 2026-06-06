/**
 * Shared ingest budget — split Paid D1 / queue load across Twitch, Kick, YouTube.
 * Kick/YouTube use single batch poll per tick (no Twitch-style sweep fan-out).
 * @see docs/23-paid-tier-zero-overage-playbook.md §3
 * @see docs/05-ingestion-per-platform.md (MVP caps)
 */

import type { IngestQueueMessage } from './messages';
import { ingestCoverageModeFromEnv, maxTrackedFromEnv, STREAMS_BATCH_SIZE, type IngestCoverageMode } from './twitch/config';
import { coverageMessagesForPlatform } from './platform-coverage';

export const INGEST_PLATFORMS = ['twitch', 'kick', 'youtube'] as const;
export type IngestPlatform = (typeof INGEST_PLATFORMS)[number];

/** Planning target under Paid 50M writes/mo (~1.67M/day) — leave headroom. */
export const PAID_D1_WRITES_PER_DAY_TARGET = 1_200_000;

/**
 * Queue + D1 live-sample share per platform (sums to 1).
 * Twitch keeps sweep fan-out; Kick/YouTube get catalog batch only.
 */
export const PLATFORM_BUDGET_SHARE: Record<IngestPlatform, number> = {
	twitch: 0.55,
	kick: 0.25,
	youtube: 0.2,
};

/** Queue messages per cron tick (coverage enqueued directly — no poll_platform hop). */
export const PLATFORM_QUEUE_FANOUT: Record<IngestPlatform, number> = {
	twitch: 1,
	kick: 1,
	youtube: 1,
};

export const QUEUE_OPS_INCLUDED_PAID_MONTH = 1_000_000;
export const QUEUE_OPS_PER_MESSAGE = 3;

/** Consolidated catalog poll when tracked ≤ this; else shards_only upgrades to full fan-out. */
export const CATALOG_CONSOLIDATED_MAX_TRACKED = 500;

export function catalogShardMessageCount(tracked: number): number {
	return Math.max(1, Math.ceil(tracked / STREAMS_BATCH_SIZE));
}

/** Per-shard fan-out (pre–lane-3): 1 platform message + S shard messages per tick. */
export function legacyShardsOnlyMessagesPerTick(tracked: number): number {
	return 1 + catalogShardMessageCount(tracked);
}

export function messagesPerTwitchCronTick(mode: IngestCoverageMode, tracked: number): number {
	switch (mode) {
		case 'full':
			return PLATFORM_QUEUE_FANOUT.twitch;
		case 'sweep_only':
			return 1;
		case 'shards_only':
			if (tracked <= CATALOG_CONSOLIDATED_MAX_TRACKED) return 1;
			return PLATFORM_QUEUE_FANOUT.twitch;
		default: {
			const exhaustiveCheck: never = mode;
			return exhaustiveCheck;
		}
	}
}

/** Every-minute twitch cron — minimum messages for INGEST_COVERAGE_MODE. */
export function twitchCronEnqueueMessages(env: Env): IngestQueueMessage[] {
	const mode = ingestCoverageModeFromEnv(env);
	const tracked = maxTrackedFromEnv(env);

	switch (mode) {
		case 'full':
			return coverageMessagesForPlatform('twitch');
		case 'sweep_only':
			return [{ type: 'poll_twitch_sweep' }];
		case 'shards_only':
			if (tracked <= CATALOG_CONSOLIDATED_MAX_TRACKED) {
				return [{ type: 'poll_twitch_catalog' }];
			}
			return coverageMessagesForPlatform('twitch');
		default: {
			const exhaustiveCheck: never = mode;
			return exhaustiveCheck;
		}
	}
}

/** MVP live caps (mid-range from doc 05) — allocator scales D1 live L per platform. */
export const PLATFORM_LIVE_STREAM_CAP: Record<IngestPlatform, number> = {
	twitch: 500,
	kick: 120,
	youtube: 80,
};

/** D1 rows written per live sample (order of magnitude). */
export const D1_WRITES_PER_LIVE_SAMPLE = 4;

/** Twitch Helix pool — Kick/YouTube do not draw from this. */
export const TWITCH_HELIX_POINTS_PER_MIN = 720;

/** Kick throttle until RPM published (ADR-003). */
export const KICK_REQUESTS_PER_MIN_BUDGET = 60;

/** YouTube Data API daily units (separate hard cap). */
export const YOUTUBE_API_UNITS_PER_DAY = 10_000;

export const TWITCH_CRON = '*/1 * * * *';
/** Staging free-tier twitch poll cadence (same enqueue shape as {@link TWITCH_CRON}). */
export const TWITCH_STAGING_CRON = '*/5 * * * *';
export const MULTI_PLATFORM_CRON = '*/2 * * * *';

export function isIngestPlatform(value: string): value is IngestPlatform {
	return (INGEST_PLATFORMS as readonly string[]).includes(value);
}

export function platformBudgetShare(platform: IngestPlatform): number {
	return PLATFORM_BUDGET_SHARE[platform];
}

export function d1WritesBudgetPerDay(platform: IngestPlatform, totalDaily = PAID_D1_WRITES_PER_DAY_TARGET): number {
	return Math.floor(totalDaily * platformBudgetShare(platform));
}

export function queueFanoutMessagesPerPoll(platform: IngestPlatform): number {
	return PLATFORM_QUEUE_FANOUT[platform];
}

/** Max live streams to plan D1 writes: share of daily write budget / (1440 * W). */
export function plannedLiveStreamCap(platform: IngestPlatform): number {
	const writesBudget = d1WritesBudgetPerDay(platform);
	const perMinute = Math.floor(writesBudget / (1440 * D1_WRITES_PER_LIVE_SAMPLE));
	return Math.min(PLATFORM_LIVE_STREAM_CAP[platform], Math.max(0, perMinute));
}

export function kickYoutubePollMessages(): IngestQueueMessage[] {
	return [{ type: 'poll_kick_tracked' }, { type: 'poll_youtube_tracked' }];
}

/** Every-2-min kick+youtube cron — one tracked-poll message each. */
export function multiPlatformCronMessages(): IngestQueueMessage[] {
	return kickYoutubePollMessages();
}

export type IngestQueueBudgetEstimate = {
	twitchMessagesPerDay: number;
	kickMessagesPerDay: number;
	youtubeMessagesPerDay: number;
	totalMessagesPerDay: number;
	queueOpsPerDay: number;
	queueOpsPerMonth: number;
	d1WritesPerDay: number;
};

export type IngestQueueBudgetInput = {
	/** Star-slash-1 ticks per day (prod 1440, staging 288). */
	twitchCronTicksPerDay: number;
	/** Star-slash-2 ticks per day (prod 720). */
	multiPlatformCronTicksPerDay: number;
	/** Extra twitch messages per minute (default 0 — enrich inline in reconcile). */
	twitchEnrichPerMinute?: number;
	/** Discover + EventSub per 6h (default 4 runs × 4 msgs). */
	discoverMessagesPerDay?: number;
	rollupMessagesPerDay?: number;
	queueOpsPerMessage?: number;
};

/**
 * Plan queue + D1 load with shared 3-way split (doc 23 calculator).
 * Twitch: fan-out only per minute; Kick/YouTube: 1 message per two-minute tick.
 */
export function estimateIngestQueueBudget(input: IngestQueueBudgetInput): IngestQueueBudgetEstimate {
	const enrich = input.twitchEnrichPerMinute ?? 0;
	const discover = input.discoverMessagesPerDay ?? 16;
	const rollup = input.rollupMessagesPerDay ?? 1;
	const opsPerMsg = input.queueOpsPerMessage ?? 3;

	const twitchPerTick = queueFanoutMessagesPerPoll('twitch') + enrich;
	const twitchMessagesPerDay = input.twitchCronTicksPerDay * twitchPerTick;
	const kickMessagesPerDay = input.multiPlatformCronTicksPerDay * queueFanoutMessagesPerPoll('kick');
	const youtubeMessagesPerDay = input.multiPlatformCronTicksPerDay * queueFanoutMessagesPerPoll('youtube');
	const totalMessagesPerDay = twitchMessagesPerDay + kickMessagesPerDay + youtubeMessagesPerDay + discover + rollup;
	const queueOpsPerDay = totalMessagesPerDay * opsPerMsg;
	const queueOpsPerMonth = queueOpsPerDay * 30;

	let d1WritesPerDay = 0;
	for (const platform of INGEST_PLATFORMS) {
		d1WritesPerDay += plannedLiveStreamCap(platform) * 1440 * D1_WRITES_PER_LIVE_SAMPLE;
	}

	return {
		twitchMessagesPerDay,
		kickMessagesPerDay,
		youtubeMessagesPerDay,
		totalMessagesPerDay,
		queueOpsPerDay,
		queueOpsPerMonth,
		d1WritesPerDay,
	};
}
