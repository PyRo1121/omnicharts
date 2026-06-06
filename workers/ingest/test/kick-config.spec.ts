import { describe, expect, it } from 'vitest';
import {
	DEFAULT_KICK_MAX_TRACKED,
	DEFAULT_KICK_MIN_VIEWERS,
	kickCredentialsConfigured,
	kickMaxTrackedFromEnv,
	kickMinViewersFromEnv,
} from '../src/kick/config';
import { testEnv } from './helpers';

describe('kick config env parsers', () => {
	it('kickMinViewersFromEnv uses KICK_MIN_VIEWERS, then TWITCH_MIN_VIEWERS, then default', () => {
		expect(kickMinViewersFromEnv(testEnv({ KICK_MIN_VIEWERS: '7' }))).toBe(7);
		expect(kickMinViewersFromEnv(testEnv({ KICK_MIN_VIEWERS: undefined, TWITCH_MIN_VIEWERS: '4' }))).toBe(4);
		expect(kickMinViewersFromEnv(testEnv({ KICK_MIN_VIEWERS: 'bad', TWITCH_MIN_VIEWERS: 'bad' }))).toBe(DEFAULT_KICK_MIN_VIEWERS);
	});

	it('kickMaxTrackedFromEnv falls back when unset or invalid', () => {
		expect(kickMaxTrackedFromEnv(testEnv({ KICK_MAX_TRACKED: '900' }))).toBe(900);
		expect(kickMaxTrackedFromEnv(testEnv({ KICK_MAX_TRACKED: '0' }))).toBe(DEFAULT_KICK_MAX_TRACKED);
		expect(kickMaxTrackedFromEnv(testEnv({ KICK_MAX_TRACKED: 'nope' }))).toBe(DEFAULT_KICK_MAX_TRACKED);
	});

	it('kickCredentialsConfigured requires non-empty client id and secret', () => {
		expect(kickCredentialsConfigured(testEnv({ KICK_CLIENT_ID: 'id', KICK_CLIENT_SECRET: 'secret' }))).toBe(true);
		expect(kickCredentialsConfigured(testEnv({ KICK_CLIENT_ID: '', KICK_CLIENT_SECRET: 'secret' }))).toBe(false);
		expect(kickCredentialsConfigured(testEnv({ KICK_CLIENT_ID: 'id', KICK_CLIENT_SECRET: '   ' }))).toBe(false);
	});
});
