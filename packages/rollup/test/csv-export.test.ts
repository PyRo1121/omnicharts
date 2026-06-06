import { describe, expect, test } from 'vitest';
import { channelDetailToCsv, channelRankingsToCsv, csvDownloadFilename, escapeCsvCell, gameRankingsToCsv } from '../src/csv-export';
import { parseResponseFormat } from '../src/response-format';

describe('parseResponseFormat', () => {
	test('defaults to json', () => {
		expect(parseResponseFormat(new URL('http://x/v1/rankings/channels'))).toEqual({
			ok: true,
			format: 'json',
		});
	});

	test('accepts csv', () => {
		expect(parseResponseFormat(new URL('http://x/v1/rankings/channels?format=csv'))).toEqual({
			ok: true,
			format: 'csv',
		});
	});

	test('rejects unknown format', () => {
		expect(parseResponseFormat(new URL('http://x/v1/rankings/channels?format=xlsx'))).toEqual({
			ok: false,
			error: 'invalid_format',
		});
	});
});

describe('escapeCsvCell', () => {
	test('quotes fields with commas', () => {
		expect(escapeCsvCell('hello, world')).toBe('"hello, world"');
	});

	test('escapes embedded quotes', () => {
		expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
	});

	test('mitigates formula injection per OWASP CSV injection guidance', () => {
		expect(escapeCsvCell('=1+1')).toBe("'=1+1");
		expect(escapeCsvCell('+cmd')).toBe("'+cmd");
		expect(escapeCsvCell('@SUM(1,1)')).toBe("'@SUM(1,1)");
		expect(escapeCsvCell(' hello')).toBe(' hello');
	});
});

describe('channelRankingsToCsv', () => {
	test('serializes ranking rows', () => {
		const csv = channelRankingsToCsv({
			platform: 'twitch',
			period: '7d',
			updated_at: '2026-06-01T00:00:00Z',
			items: [
				{
					rank: 1,
					slug: 'caedrel',
					display_name: 'Caedrel',
					avatar_url: null,
					hours_watched: 1000,
					average_viewers: 500,
					peak_viewers: 900,
					airtime_hours: 12.5,
					stream_count: 3,
					tracked_since: '2026-03-01T00:00:00Z',
				},
			],
		});
		const lines = csv.trim().split('\n');
		expect(lines[0]).toBe(
			'rank,slug,display_name,avatar_url,hours_watched,average_viewers,peak_viewers,airtime_hours,stream_count,tracked_since',
		);
		expect(lines[1]).toBe('1,caedrel,Caedrel,,1000,500,900,12.5,3,2026-03-01T00:00:00Z');
	});
});

describe('gameRankingsToCsv', () => {
	test('serializes game rows', () => {
		const csv = gameRankingsToCsv({
			platform: 'kick',
			period: '30d',
			updated_at: '2026-06-01T00:00:00Z',
			items: [
				{
					rank: 1,
					slug: 'just-chatting',
					name: 'Just Chatting',
					average_viewers: 1200,
					hours_watched: 50000,
					box_art_url: null,
				},
			],
		});
		expect(csv.trim().split('\n')[1]).toBe('1,just-chatting,Just Chatting,1200,50000');
	});
});

describe('channelDetailToCsv', () => {
	test('serializes daily rollup series', () => {
		const csv = channelDetailToCsv({
			platform: 'twitch',
			slug: 'caedrel',
			display_name: 'Caedrel',
			avatar_url: null,
			language: null,
			tracked_since: null,
			ingest_state: 'tracked',
			follower_count: null,
			description: null,
			period: '7d',
			totals: {
				hours_watched: 0,
				average_viewers: 0,
				peak_viewers: 0,
				airtime_hours: 0,
				stream_count: 0,
				followers_gain: null,
			},
			daily: [
				{
					date: '2026-06-01',
					hours_watched: 100,
					average_viewers: 50,
					peak_viewers: 80,
					airtime_hours: 4,
					stream_count: 1,
				},
			],
		});
		expect(csv.trim().split('\n')[1]).toBe('2026-06-01,100,50,80,4,1');
	});
});

describe('csvDownloadFilename', () => {
	test('builds safe attachment name', () => {
		expect(csvDownloadFilename(['twitch', 'channels', '7d'])).toBe('omnicharts-twitch-channels-7d.csv');
	});
});
