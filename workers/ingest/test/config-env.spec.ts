import { describe, it, expect } from 'vitest';
import {
	DEFAULT_MIN_VIEWERS,
	DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN,
	minViewersFromEnv,
	maxTrackedFromEnv,
	rankingMinAirtimeMinutesFromEnv,
	eventsubSyncMaxChannelsFromEnv
} from '../src/twitch/config';

describe('twitch config env parsers', () => {
	it('minViewersFromEnv uses default and clamps invalid', () => {
		expect(minViewersFromEnv({} as Env)).toBe(DEFAULT_MIN_VIEWERS);
		expect(minViewersFromEnv({ TWITCH_MIN_VIEWERS: '-1' } as Env)).toBe(DEFAULT_MIN_VIEWERS);
		expect(minViewersFromEnv({ TWITCH_MIN_VIEWERS: '5' } as Env)).toBe(5);
	});

	it('maxTrackedFromEnv rejects non-positive', () => {
		expect(maxTrackedFromEnv({ TWITCH_MAX_TRACKED: '0' } as Env)).toBe(3000);
		expect(maxTrackedFromEnv({ TWITCH_MAX_TRACKED: '100' } as Env)).toBe(100);
	});

	it('rankingMinAirtimeMinutesFromEnv parses override', () => {
		expect(rankingMinAirtimeMinutesFromEnv({} as Env)).toBe(60);
		expect(rankingMinAirtimeMinutesFromEnv({ TWITCH_RANKING_MIN_AIRTIME_MINUTES: '1' } as Env)).toBe(
			1
		);
	});

	it('eventsubSyncMaxChannelsFromEnv defaults to 125 and parses override', () => {
		expect(eventsubSyncMaxChannelsFromEnv({} as Env)).toBe(
			DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN
		);
		expect(eventsubSyncMaxChannelsFromEnv({ EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN: '50' } as Env)).toBe(
			50
		);
		expect(eventsubSyncMaxChannelsFromEnv({ EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN: '0' } as Env)).toBe(
			DEFAULT_EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN
		);
	});
});
