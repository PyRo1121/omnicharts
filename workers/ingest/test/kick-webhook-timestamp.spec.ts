import { describe, it, expect, vi, afterEach } from 'vitest';
import { isKickWebhookTimestampFresh } from '../src/kick/webhook/verify';

describe('isKickWebhookTimestampFresh', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('accepts RFC3339 timestamps within skew window', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
		expect(isKickWebhookTimestampFresh('2026-06-01T11:59:30.000Z')).toBe(true);
	});

	it('rejects stale or invalid timestamps', () => {
		expect(isKickWebhookTimestampFresh('not-a-timestamp')).toBe(false);
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
		expect(isKickWebhookTimestampFresh('2026-06-01T11:00:00.000Z')).toBe(false);
	});
});
