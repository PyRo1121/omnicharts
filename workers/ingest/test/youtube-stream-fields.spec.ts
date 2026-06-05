import { describe, it, expect } from 'vitest';
import {
	isYoutubeConcurrentViewersKnown,
	isYoutubeLive,
	parseYoutubeConcurrentViewers,
	youtubeStreamEnded,
} from '../src/youtube/stream-fields';

describe('youtube stream-fields', () => {
	it('parseYoutubeConcurrentViewers rejects invalid values', () => {
		expect(parseYoutubeConcurrentViewers(null)).toBeNull();
		expect(parseYoutubeConcurrentViewers('0')).toBeNull();
		expect(parseYoutubeConcurrentViewers('abc')).toBeNull();
		expect(parseYoutubeConcurrentViewers('42')).toBe(42);
		expect(parseYoutubeConcurrentViewers(99)).toBe(99);
	});

	it('isYoutubeConcurrentViewersKnown mirrors parse', () => {
		expect(isYoutubeConcurrentViewersKnown(undefined)).toBe(false);
		expect(isYoutubeConcurrentViewersKnown('10')).toBe(true);
	});

	it('isYoutubeLive checks liveBroadcastContent', () => {
		expect(
			isYoutubeLive({
				id: 'v',
				snippet: { channelId: 'UC', title: 't', liveBroadcastContent: 'live' },
			}),
		).toBe(true);
		expect(
			isYoutubeLive({
				id: 'v',
				snippet: { channelId: 'UC', title: 't', liveBroadcastContent: 'none' },
			}),
		).toBe(false);
	});

	it('youtubeStreamEnded handles end time and non-live content', () => {
		expect(
			youtubeStreamEnded({
				id: 'v',
				snippet: { channelId: 'UC', title: 't', liveBroadcastContent: 'live' },
				liveStreamingDetails: { actualEndTime: '2026-06-01T01:00:00Z' },
			}),
		).toBe(true);
		expect(
			youtubeStreamEnded({
				id: 'v',
				snippet: { channelId: 'UC', title: 't', liveBroadcastContent: 'none' },
			}),
		).toBe(true);
		expect(
			youtubeStreamEnded({
				id: 'v',
				snippet: { channelId: 'UC', title: 't', liveBroadcastContent: 'upcoming' },
			}),
		).toBe(false);
	});
});
