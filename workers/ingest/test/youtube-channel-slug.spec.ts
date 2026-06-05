import { describe, it, expect } from 'vitest';
import { youtubeSlugFromChannel } from '../src/youtube/channel-slug';

describe('youtubeSlugFromChannel', () => {
	it('prefers customUrl handle slug', () => {
		expect(
			youtubeSlugFromChannel({
				id: 'UCabc',
				snippet: { title: 'MrBeast', customUrl: '@MrBeast' },
			}),
		).toBe('mrbeast');
	});

	it('falls back to title slug when customUrl empty', () => {
		expect(
			youtubeSlugFromChannel({
				id: 'UCabc',
				snippet: { title: 'Some Creator Name' },
			}),
		).toBe('some-creator-name');
	});

	it('uses platform channel fallback when title and handle unusable', () => {
		expect(
			youtubeSlugFromChannel({
				id: 'UCabc',
				snippet: { title: '!!!' },
			}),
		).toMatch(/^channel-ucabc$/i);
	});
});
