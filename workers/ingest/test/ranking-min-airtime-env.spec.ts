import { describe, it, expect } from 'vitest';
import { testEnv } from './helpers';
import { rankingMinAirtimeMinutesFromEnv } from '../src/twitch/config';

describe('rankingMinAirtimeMinutesFromEnv', () => {
	it('defaults to 60 when unset', () => {
		expect(rankingMinAirtimeMinutesFromEnv(testEnv())).toBe(60);
	});

	it('reads TWITCH_RANKING_MIN_AIRTIME_MINUTES', () => {
		expect(
			rankingMinAirtimeMinutesFromEnv(testEnv({
				TWITCH_RANKING_MIN_AIRTIME_MINUTES: '1',
			})),
		).toBe(1);
	});
});
