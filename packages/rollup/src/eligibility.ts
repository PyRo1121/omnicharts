/** docs/12-channel-discovery-and-tracking.md — Ranking eligibility */

import { INGEST_STATE_TRACKED } from '@omnicharts/domain';

/** Production default when env is unset (matches TWITCH_RANKING_MIN_AIRTIME_MINUTES=60). */
export const MIN_RANKING_AIRTIME_MINUTES = 60;

export function periodAverageViewers(hoursWatched: number, airtimeMinutes: number): number {
	if (airtimeMinutes <= 0) return 0;
	return hoursWatched / (airtimeMinutes / 60);
}

export function passesRankingEligibility(opts: {
	ingestState: string;
	airtimeMinutes: number;
	hoursWatched: number;
	minViewers: number;
	/** Defaults to MIN_RANKING_AIRTIME_MINUTES; pass env-derived override in prod paths. */
	minAirtimeMinutes?: number;
}): boolean {
	const minAirtime = opts.minAirtimeMinutes ?? MIN_RANKING_AIRTIME_MINUTES;
	if (opts.ingestState !== INGEST_STATE_TRACKED) return false;
	if (opts.airtimeMinutes < minAirtime) return false;
	return periodAverageViewers(opts.hoursWatched, opts.airtimeMinutes) >= opts.minViewers;
}
