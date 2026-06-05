import { describe, it, expect } from 'vitest';
import { parseWatchlistCsv } from '../src/watchlist/csv';

describe('parseWatchlistCsv', () => {
	it('parses header + data rows', () => {
		const result = parseWatchlistCsv(`platform,slug
twitch,Ninja
kick,XQC
youtube,@mrbeast`);

		expect(result.errors).toEqual([]);
		expect(result.rows).toEqual([
			{ line: 2, platform: 'twitch', slug: 'ninja' },
			{ line: 3, platform: 'kick', slug: 'xqc' },
			{ line: 4, platform: 'youtube', slug: 'mrbeast' }
		]);
	});

	it('accepts handle column alias', () => {
		const result = parseWatchlistCsv(`platform,handle
twitch,shroud`);

		expect(result.errors).toEqual([]);
		expect(result.rows).toEqual([{ line: 2, platform: 'twitch', slug: 'shroud' }]);
	});

	it('reports invalid platform', () => {
		const result = parseWatchlistCsv('platform,slug\nfacebook,foo');

		expect(result.rows).toEqual([]);
		expect(result.errors).toEqual([
			expect.objectContaining({ line: 2, code: 'invalid_platform' })
		]);
	});

	it('reports missing slug', () => {
		const result = parseWatchlistCsv('platform,slug\ntwitch,');

		expect(result.rows).toEqual([]);
		expect(result.errors).toEqual([
			expect.objectContaining({ line: 2, code: 'missing_slug' })
		]);
	});

	it('reports malformed row', () => {
		const result = parseWatchlistCsv('only-one-column');

		expect(result.rows).toEqual([]);
		expect(result.errors).toEqual([
			expect.objectContaining({ line: 1, code: 'malformed_row' })
		]);
	});

	it('dedupes duplicate platform+slug (second row error)', () => {
		const result = parseWatchlistCsv(`platform,slug
twitch,ninja
twitch,ninja`);

		expect(result.rows).toEqual([{ line: 2, platform: 'twitch', slug: 'ninja' }]);
		expect(result.errors).toEqual([
			expect.objectContaining({ line: 3, code: 'duplicate_slug', slug: 'ninja' })
		]);
	});

	it('skips blank lines and comments', () => {
		const result = parseWatchlistCsv(`platform,slug
# agency list
twitch,ninja

kick,xqc`);

		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(2);
	});

	it('parses quoted slug fields', () => {
		const result = parseWatchlistCsv('platform,slug\ntwitch,"ninja, jr"');

		expect(result.errors).toEqual([]);
		expect(result.rows).toEqual([{ line: 2, platform: 'twitch', slug: 'ninja, jr' }]);
	});

	it('reports missing platform', () => {
		const result = parseWatchlistCsv('platform,slug\n,ninja');

		expect(result.rows).toEqual([]);
		expect(result.errors).toEqual([
			expect.objectContaining({ line: 2, code: 'missing_platform' })
		]);
	});
});
