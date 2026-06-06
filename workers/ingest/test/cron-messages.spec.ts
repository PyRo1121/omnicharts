import { describe, it, expect } from 'vitest';
import { testEnv } from './helpers';
import {
	cronToMessages,
	TWITCH_CRON,
	TWITCH_STAGING_CRON,
	MULTI_PLATFORM_CRON,
	ROLLUP_CRON,
	DISCOVER_TWITCH_CRON,
} from '../src/cron-messages';

describe('cronToMessages', () => {
	it('*/1 without env falls back to poll_platform (legacy)', () => {
		expect(cronToMessages(TWITCH_CRON)).toEqual([{ type: 'poll_platform', platform: 'twitch' }]);
	});

	it('*/1 with production env enqueues sweep+reconcile (game pass inline in sweep)', () => {
		expect(
			cronToMessages(
				TWITCH_CRON,
				testEnv({
					INGEST_COVERAGE_MODE: 'full',
				}),
			),
		).toEqual([{ type: 'poll_twitch_sweep' }, { type: 'poll_twitch_reconcile' }]);
	});

	it('*/1 staging shards_only enqueues one catalog message', () => {
		expect(
			cronToMessages(
				TWITCH_CRON,
				testEnv({
					INGEST_COVERAGE_MODE: 'shards_only',
					TWITCH_MAX_TRACKED: '200',
				}),
			),
		).toEqual([{ type: 'poll_twitch_catalog' }]);
	});

	it('*/5 staging cron matches */1 twitch enqueue (legacy without env)', () => {
		expect(cronToMessages(TWITCH_STAGING_CRON)).toEqual([{ type: 'poll_platform', platform: 'twitch' }]);
	});

	it('*/5 staging shards_only enqueues one catalog message', () => {
		expect(
			cronToMessages(
				TWITCH_STAGING_CRON,
				testEnv({
					INGEST_COVERAGE_MODE: 'shards_only',
					TWITCH_MAX_TRACKED: '200',
				}),
			),
		).toEqual([{ type: 'poll_twitch_catalog' }]);
	});

	it('*/2 enqueues kick and youtube tracked poll (no twitch)', () => {
		expect(cronToMessages(MULTI_PLATFORM_CRON)).toEqual([{ type: 'poll_kick_tracked' }, { type: 'poll_youtube_tracked' }]);
	});

	it('rollup cron enqueues rollup_daily', () => {
		expect(cronToMessages(ROLLUP_CRON)).toEqual([{ type: 'rollup_daily' }]);
	});

	it('discover cron enqueues twitch discover + eventsub sync + kick discover', () => {
		expect(cronToMessages(DISCOVER_TWITCH_CRON)).toEqual([
			{ type: 'discover_twitch' },
			{ type: 'sync_eventsub_twitch' },
			{ type: 'discover_kick' },
		]);
	});

	it('discover cron optionally enqueues vod backfill when enabled', () => {
		expect(cronToMessages(DISCOVER_TWITCH_CRON, testEnv({ VOD_BACKFILL_ON_DISCOVER: '1' }))).toEqual([
			{ type: 'discover_twitch' },
			{ type: 'sync_eventsub_twitch' },
			{ type: 'discover_kick' },
			{ type: 'vod_backfill_twitch' },
		]);
	});

	it('unknown cron returns empty', () => {
		expect(cronToMessages('0 0 1 1 *')).toEqual([]);
	});
});
