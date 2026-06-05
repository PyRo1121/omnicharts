import { describe, it, expect } from 'vitest';
import { filterHelixTwitchUserIds, isDevSeedPlatformChannelId, isHelixTwitchUserId } from '../src/twitch/platform-id';

describe('platform-id', () => {
	it('accepts numeric Twitch ids', () => {
		expect(isHelixTwitchUserId('545050196')).toBe(true);
		expect(isHelixTwitchUserId('dev-1')).toBe(false);
		expect(isHelixTwitchUserId('')).toBe(false);
	});

	it('flags dev seed ids', () => {
		expect(isDevSeedPlatformChannelId('dev-1')).toBe(true);
		expect(isDevSeedPlatformChannelId('545050196')).toBe(false);
	});

	it('filterHelixTwitchUserIds drops dev seed and non-numeric', () => {
		expect(filterHelixTwitchUserIds(['545050196', 'dev-1', 'abc', '999'])).toEqual(['545050196', '999']);
	});
});
