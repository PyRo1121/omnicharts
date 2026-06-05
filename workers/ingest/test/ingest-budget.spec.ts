import { describe, it, expect } from 'vitest';
import { testEnv } from './helpers';
import {
	CATALOG_CONSOLIDATED_MAX_TRACKED,
	PLATFORM_BUDGET_SHARE,
	PLATFORM_QUEUE_FANOUT,
	PAID_D1_WRITES_PER_DAY_TARGET,
	QUEUE_OPS_INCLUDED_PAID_MONTH,
	QUEUE_OPS_PER_MESSAGE,
	catalogShardMessageCount,
	d1WritesBudgetPerDay,
	estimateIngestQueueBudget,
	legacyShardsOnlyMessagesPerTick,
	messagesPerTwitchCronTick,
	multiPlatformCronMessages,
	plannedLiveStreamCap,
	queueFanoutMessagesPerPoll,
	twitchCronEnqueueMessages,
} from '../src/ingest-budget';
import { coverageMessagesForPlatform } from '../src/platform-coverage';

describe('ingest budget allocator', () => {
	it('splits D1 write budget three ways (sums to target)', () => {
		const total = (['twitch', 'kick', 'youtube'] as const).reduce((sum, p) => sum + d1WritesBudgetPerDay(p), 0);
		expect(total).toBeLessThanOrEqual(PAID_D1_WRITES_PER_DAY_TARGET);
		expect(PLATFORM_BUDGET_SHARE.twitch + PLATFORM_BUDGET_SHARE.kick + PLATFORM_BUDGET_SHARE.youtube).toBe(1);
	});

	it('gives Twitch sweep+reconcile fan-out, Kick/YouTube single message', () => {
		expect(queueFanoutMessagesPerPoll('twitch')).toBe(2);
		expect(queueFanoutMessagesPerPoll('kick')).toBe(1);
		expect(queueFanoutMessagesPerPoll('youtube')).toBe(1);
		expect(PLATFORM_QUEUE_FANOUT.twitch).toBe(2);
	});

	it('caps planned live streams per platform', () => {
		expect(plannedLiveStreamCap('twitch')).toBeGreaterThan(plannedLiveStreamCap('kick'));
		expect(plannedLiveStreamCap('kick')).toBeGreaterThan(0);
		expect(plannedLiveStreamCap('youtube')).toBeGreaterThan(0);
	});

	it('multiPlatformCronMessages enqueues kick and youtube tracked poll', () => {
		expect(multiPlatformCronMessages()).toEqual([{ type: 'poll_kick_tracked' }, { type: 'poll_youtube_tracked' }]);
	});

	it('full cron uses two messages without poll_platform hop', () => {
		expect(messagesPerTwitchCronTick('full', 3000)).toBe(2);
		const msgs = twitchCronEnqueueMessages(testEnv({ INGEST_COVERAGE_MODE: 'full' }));
		expect(msgs.map((m) => m.type)).toEqual(['poll_twitch_sweep', 'poll_twitch_reconcile']);
	});

	it('shards_only at 3k upgrades to full fan-out (not 31 legacy shard msgs)', () => {
		expect(catalogShardMessageCount(3000)).toBe(30);
		expect(legacyShardsOnlyMessagesPerTick(3000)).toBe(31);
		expect(messagesPerTwitchCronTick('shards_only', 3000)).toBe(2);
	});

	it('staging shards_only consolidates catalog when tracked <= 500', () => {
		expect(messagesPerTwitchCronTick('shards_only', 200)).toBe(1);
		expect(CATALOG_CONSOLIDATED_MAX_TRACKED).toBe(500);
	});

	it('legacy shards_only at 3k exceeds paid queue bundle', () => {
		const legacyOps = 1440 * legacyShardsOnlyMessagesPerTick(3000) * 30 * QUEUE_OPS_PER_MESSAGE;
		expect(legacyOps).toBeGreaterThan(QUEUE_OPS_INCLUDED_PAID_MONTH);
	});
});

describe('platform coverage messages', () => {
	it('kick and youtube use tracked batch only (no twitch sweep types)', () => {
		expect(coverageMessagesForPlatform('kick')).toEqual([{ type: 'poll_kick_tracked' }]);
		expect(coverageMessagesForPlatform('youtube')).toEqual([{ type: 'poll_youtube_tracked' }]);
	});

	it('twitch keeps sweep+reconcile fan-out (game pass runs inside sweep)', () => {
		const twitch = coverageMessagesForPlatform('twitch');
		expect(twitch).toEqual([{ type: 'poll_twitch_sweep' }, { type: 'poll_twitch_reconcile' }]);
	});
});

describe('estimateIngestQueueBudget', () => {
	it('adds kick+youtube */2 load without tripling twitch fan-out', () => {
		const twitchOnly = estimateIngestQueueBudget({
			twitchCronTicksPerDay: 1440,
			multiPlatformCronTicksPerDay: 0,
		});
		const threePlatform = estimateIngestQueueBudget({
			twitchCronTicksPerDay: 1440,
			multiPlatformCronTicksPerDay: 720,
		});
		expect(threePlatform.kickMessagesPerDay).toBe(720);
		expect(threePlatform.youtubeMessagesPerDay).toBe(720);
		expect(threePlatform.totalMessagesPerDay).toBe(twitchOnly.totalMessagesPerDay + 720 + 720);
		expect(threePlatform.queueOpsPerMonth).toBeLessThan(1_000_000);
	});
});
