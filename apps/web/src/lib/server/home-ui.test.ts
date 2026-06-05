import { describe, it, expect } from 'vitest';
import {
	channelsPageSubtitle,
	parseUiPlatform,
	platformQueryParam,
	routeWithPlatform,
	searchPageSubtitle,
	searchPlatformId,
} from '$lib/ui/platform.svelte';

describe('parseUiPlatform', () => {
	it.each([
		['twitch', 'twitch'],
		['kick', 'kick'],
		['youtube', 'youtube'],
		['all', 'all'],
		[null, 'twitch'],
		['', 'twitch'],
		['invalid', 'twitch'],
		['TWITCH', 'twitch'],
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

describe('routeWithPlatform', () => {
	it('preserves non-default platform on nav targets', () => {
		expect(routeWithPlatform('/channels', 'kick')).toBe('/channels?platform=kick');
		expect(routeWithPlatform('/games', 'youtube')).toBe('/games?platform=youtube');
		expect(routeWithPlatform('/overview', 'twitch')).toBe('/overview');
	});

	it('merges extra query params', () => {
		expect(routeWithPlatform('/channels', 'kick', { period: '7d' })).toBe('/channels?period=7d&platform=kick');
		expect(routeWithPlatform('/search', 'kick', { q: 'xqc' })).toBe('/search?q=xqc&platform=kick');
	});
});

describe('channelsPageSubtitle', () => {
	it('names Kick for kick tab when live', () => {
		expect(channelsPageSubtitle('kick', 'live')).toMatch(/Kick/i);
		expect(channelsPageSubtitle('kick', 'live')).not.toMatch(/Twitch/i);
	});

	it('defaults to Twitch copy for twitch tab', () => {
		expect(channelsPageSubtitle('twitch', 'live')).toMatch(/Twitch/i);
	});

	it('names YouTube for youtube tab when live', () => {
		expect(channelsPageSubtitle('youtube', 'live')).toMatch(/YouTube/i);
	});
});
