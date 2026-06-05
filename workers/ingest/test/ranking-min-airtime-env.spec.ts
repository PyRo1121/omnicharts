import { describe, it, expect } from 'vitest';
import { rankingMinAirtimeMinutesFromEnv } from '../src/twitch/config';

describe('rankingMinAirtimeMinutesFromEnv', () => {
	it('defaults to 60 when unset', () => {
		expect(rankingMinAirtimeMinutesFromEnv({} as Env)).toBe(60);
	});

	it('reads TWITCH_RANKING_MIN_AIRTIME_MINUTES', () => {
		expect(
			rankingMinAirtimeMinutesFromEnv({
				TWITCH_RANKING_MIN_AIRTIME_MINUTES: '1',
			} as Env),
		).toBe(1);
	});
});
