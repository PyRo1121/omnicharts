import { describe, it, expect } from 'vitest';
import linear from './fixtures/samples_linear.json';
import ramp from './fixtures/samples_ramp.json';
import multi from './fixtures/multi_stream_day.json';
import { computeHoursWatched, computePeakViewers, computeAverageViewers, type ViewerSamplePoint } from '../src/rollup/math';

function fixtureToPoints(baseMs: number, fixture: { samples: { offsetMinutes: number; viewerCount: number }[] }): ViewerSamplePoint[] {
	return fixture.samples.map((s) => ({
		sampledAtMs: baseMs + s.offsetMinutes * 60_000,
		viewerCount: s.viewerCount,
	}));
}

describe('rollup math (docs/04-metrics-glossary.md)', () => {
	const baseMs = Date.parse('2026-05-30T12:00:00.000Z');

	it('samples_linear: constant 100 viewers × 60 min → HW = 100', () => {
		const points = fixtureToPoints(baseMs, linear);
		const hw = computeHoursWatched(points, linear.defaultIntervalMinutes);
		expect(hw).toBeCloseTo(linear.expectedHoursWatched, 2);
	});

	it('samples_ramp: linear ramp 0→100 over 60 min → HW = 50', () => {
		const points = fixtureToPoints(baseMs, ramp);
		const hw = computeHoursWatched(points, ramp.defaultIntervalMinutes);
		expect(hw).toBeCloseTo(ramp.expectedHoursWatched, 2);
	});

	it('computePeakViewers returns max', () => {
		const points = fixtureToPoints(baseMs, linear);
		expect(computePeakViewers(points)).toBe(100);
	});

	it('computeAverageViewers = HW / airtime_hours', () => {
		const points = fixtureToPoints(baseMs, linear);
		const hw = computeHoursWatched(points, 1);
		const av = computeAverageViewers(hw, 60);
		expect(av).toBeCloseTo(100, 2);
	});

	it('multi_stream_day sessions sum HW', () => {
		let total = 0;
		for (const session of multi.sessions) {
			const points = fixtureToPoints(baseMs, session);
			total += computeHoursWatched(points, multi.defaultIntervalMinutes);
		}
		expect(total).toBeCloseTo(multi.expectedTotalHoursWatched, 2);
	});
});
