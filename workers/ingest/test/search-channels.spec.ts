import { describe, it, expect } from 'vitest';
import {
	escapeLikePattern,
	normalizeSearchQuery,
	parseSearchChannelsQuery
} from '../src/search/channels';

describe('searchChannels validation', () => {
	it('normalizeSearchQuery trims, strips @, collapses whitespace, and lowercases', () => {
		expect(normalizeSearchQuery('  ShRoUd  ')).toBe('shroud');
		expect(normalizeSearchQuery('@shroud')).toBe('shroud');
		expect(normalizeSearchQuery('  @  shroud  ')).toBe('shroud');
		expect(normalizeSearchQuery('foo   bar')).toBe('foo bar');
	});

	it('escapeLikePattern escapes wildcards', () => {
		expect(escapeLikePattern('100%_win')).toBe('100\\%\\_win');
		expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
	});

	it('parseSearchChannelsQuery rejects query shorter than 2 chars', () => {
		const url = new URL('http://x/v1/search/channels?q=a&platform=twitch');
		expect(parseSearchChannelsQuery(url)).toEqual({ ok: false, error: 'invalid_query' });
	});

	it('parseSearchChannelsQuery rejects query longer than 100 chars', () => {
		const url = new URL(`http://x/v1/search/channels?q=${'x'.repeat(101)}&platform=twitch`);
		expect(parseSearchChannelsQuery(url)).toEqual({ ok: false, error: 'invalid_query' });
	});

	it('parseSearchChannelsQuery rejects NaN limit', () => {
		const url = new URL('http://x/v1/search/channels?q=sh&platform=twitch&limit=abc');
		expect(parseSearchChannelsQuery(url)).toEqual({ ok: false, error: 'invalid_limit' });
	});

	it('parseSearchChannelsQuery rejects invalid platform', () => {
		const url = new URL('http://x/v1/search/channels?q=sh&platform=invalid');
		expect(parseSearchChannelsQuery(url)).toEqual({ ok: false, error: 'invalid_platform' });
	});

	it('parseSearchChannelsQuery accepts valid params', () => {
		const url = new URL('http://x/v1/search/channels?q=ShRoUd&platform=twitch&limit=5');
		expect(parseSearchChannelsQuery(url)).toEqual({
			ok: true,
			platformId: 'twitch',
			query: 'shroud',
			limit: 5
		});
	});
});
