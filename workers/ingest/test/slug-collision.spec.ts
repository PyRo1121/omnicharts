import { describe, it, expect } from 'vitest';
import { slugify, slugWithPlatformChannelFallback } from '../src/twitch/slug';

describe('slug collision', () => {
	it('slugify collapses distinct logins', () => {
		expect(slugify('foo__bar')).toBe(slugify('foo_bar'));
	});

	it('fallback appends platform channel id within 64 chars', () => {
		const slug = slugWithPlatformChannelFallback('foo-bar', '12345');
		expect(slug).toBe('foo-bar-12345');
		expect(slug.length).toBeLessThanOrEqual(64);
	});
});
