import { describe, expect, test } from 'bun:test';
import { MIN_RANKING_AIRTIME_MINUTES, periodAverageViewers, passesRankingEligibility } from '../src/eligibility';

describe('ranking eligibility (docs/12-channel-discovery-and-tracking.md)', () => {
	test('requires tracked state', () => {
		expect(
			passesRankingEligibility({
				ingestState: 'discovered',
				airtimeMinutes: 120,
				hoursWatched: 10,
				minViewers: 20,
			}),
		).toBe(false);
	});

	test('requires 60+ airtime minutes in period (default gate)', () => {
		expect(
			passesRankingEligibility({
				ingestState: 'tracked',
				airtimeMinutes: 59,
				hoursWatched: 100,
				minViewers: 20,
			}),
		).toBe(false);
	});

	test('honors minAirtimeMinutes override (local checkpoint)', () => {
		expect(
			passesRankingEligibility({
				ingestState: 'tracked',
				airtimeMinutes: 1,
				hoursWatched: 100,
				minViewers: 2,
				minAirtimeMinutes: 1,
			}),
		).toBe(true);
	});

	test('requires period average viewers >= min threshold', () => {
		expect(
			passesRankingEligibility({
				ingestState: 'tracked',
				airtimeMinutes: 120,
				hoursWatched: 10,
				minViewers: 20,
			}),
		).toBe(false);
	});

	test('passes when tracked, airtime, and AV meet threshold', () => {
		expect(
			passesRankingEligibility({
				ingestState: 'tracked',
				airtimeMinutes: 120,
				hoursWatched: 40,
				minViewers: 20,
			}),
		).toBe(true);
	});

	test('periodAverageViewers = HW / airtime_hours', () => {
		expect(periodAverageViewers(50, 60)).toBeCloseTo(50, 2);
	});

	test('exports default min airtime constant', () => {
		expect(MIN_RANKING_AIRTIME_MINUTES).toBe(60);
	});
});
