import { describe, it, expect } from 'vitest';
import multi from './fixtures/multi_stream_day.json';
import { combineSessionMetrics, aggregateSessionSamples, type ViewerSamplePoint } from '../src/rollup/math';

function sessionPoints(baseMs: number, session: { samples: { offsetMinutes: number; viewerCount: number }[] }): ViewerSamplePoint[] {
	return session.samples.map((s) => ({
		sampledAtMs: baseMs + s.offsetMinutes * 60_000,
		viewerCount: s.viewerCount,
	}));
}

describe('combineSessionMetrics', () => {
	const baseMs = Date.parse('2026-05-30T12:00:00.000Z');

	it('multi_stream_day: 2 streams, total HW 80', () => {
		const sessions = multi.sessions.map((s) => aggregateSessionSamples(sessionPoints(baseMs, s), multi.defaultIntervalMinutes));
		const day = combineSessionMetrics(sessions);
		expect(day.streamCount).toBe(multi.expectedStreamCount);
		expect(day.hoursWatched).toBeCloseTo(multi.expectedTotalHoursWatched, 2);
	});
});
