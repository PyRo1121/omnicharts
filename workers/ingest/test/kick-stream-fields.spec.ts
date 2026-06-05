import { describe, it, expect } from 'vitest';
import {
	isKickViewerCountKnown,
	kickPlatformStreamId,
	kickSessionRowId
} from '../src/kick/stream-fields';

describe('kick stream-fields', () => {
	it('kickPlatformStreamId uses channel_id and started_at', () => {
		expect(
			kickPlatformStreamId({
				broadcaster_user_id: 1,
				channel_id: 99,
				slug: 'x',
				stream_title: 't',
				started_at: '2026-06-01T12:00:00Z'
			})
		).toBe('99-2026-06-01T12:00:00Z');
	});

	it('isKickViewerCountKnown rejects null, zero, and accepts positive numbers', () => {
		expect(isKickViewerCountKnown(null)).toBe(false);
		expect(isKickViewerCountKnown(undefined)).toBe(false);
		expect(isKickViewerCountKnown(0)).toBe(false);
		expect(isKickViewerCountKnown(42)).toBe(true);
	});

	it('kickSessionRowId is stable for same stream', () => {
		const stream = {
			broadcaster_user_id: 1,
			channel_id: 99,
			slug: 'x',
			stream_title: 't',
			started_at: '2026-06-01T12:00:00Z'
		};
		expect(kickSessionRowId(stream)).toBe(kickSessionRowId(stream));
	});
});
