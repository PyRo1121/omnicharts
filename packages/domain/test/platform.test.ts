import { describe, expect, test } from 'bun:test';
import { isPlatformId, parsePlatformId, platformIds } from '../src/platform';

describe('platform ids', () => {
	test('platformIds matches D1 seed rows', () => {
		expect(platformIds).toEqual(['twitch', 'kick', 'youtube']);
	});

	test('isPlatformId rejects unknown platforms', () => {
		expect(isPlatformId('twitch')).toBe(true);
		expect(isPlatformId('all')).toBe(false);
	});

	test('parsePlatformId falls back to twitch', () => {
		expect(parsePlatformId(null)).toBe('twitch');
		expect(parsePlatformId('kick')).toBe('kick');
		expect(parsePlatformId('unknown')).toBe('twitch');
	});
});
