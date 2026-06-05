/** UTC calendar date `YYYY-MM-DD`. */
export function toUtcDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function yesterdayUtcDateString(now = new Date()): string {
	const d = new Date(now);
	d.setUTCDate(d.getUTCDate() - 1);
	return toUtcDateString(d);
}

/** Inclusive start of UTC day as ISO. */
export function utcDayStartIso(dateStr: string): string {
	return `${dateStr}T00:00:00.000Z`;
}

export function utcDayEndIso(dateStr: string): string {
	return `${dateStr}T23:59:59.999Z`;
}

/** Exclusive upper bound for UTC day range scans (index-friendly vs `date()`). */
export function utcDayEndExclusiveIso(dateStr: string): string {
	const d = new Date(`${dateStr}T00:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString();
}
