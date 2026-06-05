import { describe, it, expect } from 'vitest';
import { testEnv, unusedIngestD1 } from './helpers';
import {
	EVENTSUB_SECRET_MAX_LENGTH,
	EVENTSUB_SECRET_MIN_LENGTH,
	isValidTwitchEventSubSecret,
	twitchEventSubSecretLengthMessage,
} from '../src/twitch/eventsub/secret';
import { syncTwitchEventSubSubscriptions } from '../src/twitch/eventsub/sync';

describe('Twitch EventSub secret length', () => {
	it('accepts 10–100 character secrets', () => {
		expect(EVENTSUB_SECRET_MIN_LENGTH).toBe(10);
		expect(EVENTSUB_SECRET_MAX_LENGTH).toBe(100);
		expect(isValidTwitchEventSubSecret('1234567890')).toBe(true);
		expect(isValidTwitchEventSubSecret('a'.repeat(100))).toBe(true);
	});

	it('rejects too short or too long secrets', () => {
		expect(isValidTwitchEventSubSecret('')).toBe(false);
		expect(isValidTwitchEventSubSecret('short')).toBe(false);
		expect(isValidTwitchEventSubSecret('a'.repeat(101))).toBe(false);
		expect(twitchEventSubSecretLengthMessage(4)).toContain('10');
		expect(twitchEventSubSecretLengthMessage(4)).toContain('got 4');
	});

	it('sync rejects short secret before Helix', async () => {
		const stats = await syncTwitchEventSubSubscriptions(testEnv({
			DB: unusedIngestD1(),
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'sec',
			TWITCH_EVENTSUB_SECRET: 'tiny',
			TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/hook',
		}));

		expect(stats.errors).toBe(1);
		expect(stats.errorSamples[0]).toMatch(/10/);
		expect(stats.created).toBe(0);
	});
});
