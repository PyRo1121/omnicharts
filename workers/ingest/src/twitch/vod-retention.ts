/** Tier-limited Twitch VOD retention windows — docs/05-ingestion-per-platform.md */

export const VOD_RETENTION_DAYS_DEFAULT = 7;
export const VOD_RETENTION_DAYS_AFFILIATE = 14;
export const VOD_RETENTION_DAYS_PARTNER = 60;

export function vodRetentionDaysForBroadcasterType(
	broadcasterType: string | null | undefined
): number {
	const t = (broadcasterType ?? '').trim().toLowerCase();
	if (t === 'partner') return VOD_RETENTION_DAYS_PARTNER;
	if (t === 'affiliate') return VOD_RETENTION_DAYS_AFFILIATE;
	return VOD_RETENTION_DAYS_DEFAULT;
}

export function isVideoWithinRetention(
	publishedAt: string,
	retentionDays: number,
	nowMs = Date.now()
): boolean {
	const publishedMs = Date.parse(publishedAt);
	if (!Number.isFinite(publishedMs)) return false;
	const cutoffMs = nowMs - retentionDays * 24 * 60 * 60 * 1000;
	return publishedMs >= cutoffMs;
}

/** Parse Helix ISO 8601 duration (PT#H#M#S) to milliseconds. */
export function parseIso8601DurationMs(duration: string): number | null {
	const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(duration.trim());
	if (!match) return null;
	const hours = Number(match[1] ?? 0);
	const minutes = Number(match[2] ?? 0);
	const seconds = Number(match[3] ?? 0);
	if (![hours, minutes, seconds].every((n) => Number.isFinite(n))) return null;
	return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export function vodSessionTimes(
	video: { created_at: string; duration: string },
	nowMs = Date.now()
): { started_at: string; ended_at: string | null } {
	const startedMs = Date.parse(video.created_at);
	if (!Number.isFinite(startedMs)) {
		return { started_at: video.created_at, ended_at: null };
	}
	const durationMs = parseIso8601DurationMs(video.duration);
	if (durationMs == null || durationMs <= 0) {
		return { started_at: new Date(startedMs).toISOString(), ended_at: null };
	}
	const endedMs = Math.min(startedMs + durationMs, nowMs);
	return {
		started_at: new Date(startedMs).toISOString(),
		ended_at: new Date(endedMs).toISOString()
	};
}
