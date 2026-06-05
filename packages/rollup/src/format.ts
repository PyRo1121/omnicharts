/** Compact display for leaderboard cells (hours watched, avg viewers, etc.). */
export function formatHoursWatched(hours: number): string {
	return formatCompactMetric(hours);
}

/** Alias for non–hours-watched metrics (avg viewers, counts). */
export function formatCompactMetric(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return Math.round(n).toString();
}
