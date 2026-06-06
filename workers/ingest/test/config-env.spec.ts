import { describe, it, expect } from 'vitest';
import { testEnv, testEnvProductionDefaults } from './helpers';
import {
	DEFAULT_MIN_VIEWERS,
	DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN,
	minViewersFromEnv,
	maxTrackedFromEnv,
	rankingMinAirtimeMinutesFromEnv,
	eventsubSyncMaxChannelsFromEnv,
} from '../src/twitch/config';

describe('twitch config env parsers', () => {
	it('minViewersFromEnv uses default and clamps invalid', () => {
		expect(minViewersFromEnv(testEnvProductionDefaults())).toBe(DEFAULT_MIN_VIEWERS);
		expect(minViewersFromEnv(testEnv({ TWITCH_MIN_VIEWERS: '-1' }))).toBe(DEFAULT_MIN_VIEWERS);
		expect(minViewersFromEnv(testEnv({ TWITCH_MIN_VIEWERS: '5' }))).toBe(5);
	});

	it('maxTrackedFromEnv rejects non-positive', () => {
		expect(maxTrackedFromEnv(testEnv({ TWITCH_MAX_TRACKED: '0' }))).toBe(3000);
		expect(maxTrackedFromEnv(testEnv({ TWITCH_MAX_TRACKED: '100' }))).toBe(100);
	});

	it('rankingMinAirtimeMinutesFromEnv parses override', () => {
		expect(rankingMinAirtimeMinutesFromEnv(testEnv())).toBe(60);
		expect(rankingMinAirtimeMinutesFromEnv(testEnv({ TWITCH_RANKING_MIN_AIRTIME_MINUTES: '1' }))).toBe(1);
	});

	it('eventsubSyncMaxChannelsFromEnv defaults to 125 and parses override', () => {
		expect(eventsubSyncMaxChannelsFromEnv(testEnvProductionDefaults())).toBe(DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN);
		expect(eventsubSyncMaxChannelsFromEnv(testEnv({ EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN: '50' }))).toBe(50);
		expect(eventsubSyncMaxChannelsFromEnv(testEnv({ EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN: '0' }))).toBe(
			DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN,
		);
	});
});
