import { describe, it, expect, vi, afterEach } from 'vitest';
import { isEventSubTimestampFresh } from '../src/twitch/eventsub/verify';

/** Twitch-Eventsub-Message-Timestamp (RFC3339, nanosecond precision). */
function twitchEventSubTimestamp(date: Date): string {
	return date.toISOString().replace(/\.\d{3}Z$/, '.000000000Z');
}

describe('isEventSubTimestampFresh', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('accepts Twitch RFC3339 timestamps within skew window', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
		const recent = new Date('2026-06-01T11:59:30.000Z');
		expect(isEventSubTimestampFresh(twitchEventSubTimestamp(recent))).toBe(true);
	});

	it('rejects stale or invalid timestamps', () => {
		expect(isEventSubTimestampFresh('not-a-timestamp')).toBe(false);
		expect(isEventSubTimestampFresh(String(Math.floor(Date.now() / 1000)))).toBe(false);
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
		const stale = new Date('2026-06-01T11:00:00.000Z');
		expect(isEventSubTimestampFresh(twitchEventSubTimestamp(stale))).toBe(false);
	});
});
