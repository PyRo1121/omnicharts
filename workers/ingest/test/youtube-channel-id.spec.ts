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
