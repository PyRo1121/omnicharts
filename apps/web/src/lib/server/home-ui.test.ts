import { describe, it, expect } from 'vitest';
import {
	parseUiPlatform,
	platformQueryParam,
	searchPageSubtitle,
	searchPlatformId
} from '$lib/mock/home';

describe('parseUiPlatform', () => {
	it.each([
		['twitch', 'twitch'],
		['kick', 'kick'],
		['youtube', 'youtube'],
		['all', 'all'],
		[null, 'twitch'],
		['', 'twitch'],
		['invalid', 'twitch'],
		['TWITCH', 'twitch']
	] as const)('maps %s → %s', (raw, expected) => {
		expect(parseUiPlatform(raw)).toBe(expected);
	});
});

describe('searchPageSubtitle', () => {
	it('names the active platform', () => {
		expect(searchPageSubtitle('kick')).toMatch(/Kick/i);
		expect(searchPageSubtitle('youtube')).toMatch(/YouTube/i);
	});
});

describe('searchPlatformId', () => {
	it('maps all to twitch for ingest search', () => {
		expect(searchPlatformId('all')).toBe('twitch');
	});
});

describe('platformQueryParam', () => {
	it('omits twitch default', () => {
		expect(platformQueryParam('twitch')).toBe('');
		expect(platformQueryParam('kick')).toBe('&platform=kick');
	});
});
