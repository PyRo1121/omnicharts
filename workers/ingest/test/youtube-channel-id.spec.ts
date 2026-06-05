import { describe, it, expect } from 'vitest';
import { isYoutubeChannelId, normalizeYoutubeHandle } from '../src/youtube/channel-id';

describe('isYoutubeChannelId', () => {
	it('accepts UC-prefixed 24-char channel ids', () => {
		expect(isYoutubeChannelId('UCabcdefghijklmnopqrstuv')).toBe(true);
	});

	it('rejects non-UC ids', () => {
		expect(isYoutubeChannelId('mrbeast')).toBe(false);
		expect(isYoutubeChannelId('UCshort')).toBe(false);
	});
});

describe('normalizeYoutubeHandle', () => {
	it('strips leading @ and lowercases', () => {
		expect(normalizeYoutubeHandle('@MrBeast')).toBe('mrbeast');
	});
});

describe('shouldTryYoutubeApiSeed', () => {
	it('rejects short or invalid queries', async () => {
		const { shouldTryYoutubeApiSeed } = await import('../src/youtube/channel-id');
		expect(shouldTryYoutubeApiSeed('a')).toBe(false);
		expect(shouldTryYoutubeApiSeed('bad handle!')).toBe(false);
	});

	it('accepts UC channel id and handle slugs', async () => {
		const { shouldTryYoutubeApiSeed } = await import('../src/youtube/channel-id');
		expect(shouldTryYoutubeApiSeed('UCabcdefghijklmnopqrstuv')).toBe(true);
		expect(shouldTryYoutubeApiSeed('@mr.beast_1')).toBe(true);
	});
});
