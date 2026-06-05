/**
 * Rollup formulas — docs/04-metrics-glossary.md
 * HW = sum(viewer_count × interval_hours); AV = HW / airtime_hours
 */

export type ViewerSamplePoint = {
	sampledAtMs: number;
	viewerCount: number;
};

/**
 * Time-weighted hours watched from ordered samples.
 * Uses elapsed time to next sample; last sample uses `defaultIntervalMinutes`.
 */
export function computeHoursWatched(
	samples: ViewerSamplePoint[],
	defaultIntervalMinutes = 1
): number {
	if (samples.length === 0) return 0;

	const sorted = [...samples].sort((a, b) => a.sampledAtMs - b.sampledAtMs);
	let total = 0;

	for (let i = 0; i < sorted.length - 1; i++) {
		const current = sorted[i]!;
		const next = sorted[i + 1]!;
		const intervalHours = (next.sampledAtMs - current.sampledAtMs) / 3_600_000;
		if (intervalHours <= 0) continue;
		const avgViewers = (current.viewerCount + next.viewerCount) / 2;
		total += avgViewers * intervalHours;
	}

	if (sorted.length === 1) {
		total += sorted[0]!.viewerCount * (defaultIntervalMinutes / 60);
	}

	return total;
}

export function computePeakViewers(samples: ViewerSamplePoint[]): number {
	if (samples.length === 0) return 0;
	return Math.max(...samples.map((s) => s.viewerCount));
}

export function computeAverageViewers(hoursWatched: number, airtimeMinutes: number): number {
	if (airtimeMinutes <= 0) return 0;
	return hoursWatched / (airtimeMinutes / 60);
}

/** Minutes spanned by samples (first → last) plus one default interval. */
export function computeAirtimeMinutesFromSamples(
	samples: ViewerSamplePoint[],
	defaultIntervalMinutes = 1
): number {
	if (samples.length === 0) return 0;
	if (samples.length === 1) return defaultIntervalMinutes;

	const sorted = [...samples].sort((a, b) => a.sampledAtMs - b.sampledAtMs);
	const first = sorted[0]!;
	const last = sorted[sorted.length - 1]!;
	const spanMs = last.sampledAtMs - first.sampledAtMs;
	return Math.max(defaultIntervalMinutes, Math.round(spanMs / 60_000) + defaultIntervalMinutes);
}

export type SessionDayMetrics = {
	hoursWatched: number;
	averageViewers: number;
	peakViewers: number;
	airtimeMinutes: number;
};

export function aggregateSessionSamples(
	samples: ViewerSamplePoint[],
	defaultIntervalMinutes = 1
): SessionDayMetrics {
	const hoursWatched = computeHoursWatched(samples, defaultIntervalMinutes);
	const airtimeMinutes = computeAirtimeMinutesFromSamples(samples, defaultIntervalMinutes);
	const peakViewers = computePeakViewers(samples);

	return {
		hoursWatched,
		airtimeMinutes,
		peakViewers,
		averageViewers: computeAverageViewers(hoursWatched, airtimeMinutes)
	};
}

export type ChannelDayMetrics = {
	hoursWatched: number;
	averageViewers: number;
	peakViewers: number;
	airtimeMinutes: number;
	streamCount: number;
};

export function combineSessionMetrics(sessions: SessionDayMetrics[]): ChannelDayMetrics {
	if (sessions.length === 0) {
		return {
			hoursWatched: 0,
			averageViewers: 0,
			peakViewers: 0,
			airtimeMinutes: 0,
			streamCount: 0
		};
	}

	const hoursWatched = sessions.reduce((s, m) => s + m.hoursWatched, 0);
	const airtimeMinutes = sessions.reduce((s, m) => s + m.airtimeMinutes, 0);
	const peakViewers = Math.max(...sessions.map((m) => m.peakViewers));

	return {
		hoursWatched,
		airtimeMinutes,
		peakViewers,
		streamCount: sessions.length,
		averageViewers: computeAverageViewers(hoursWatched, airtimeMinutes)
	};
}
