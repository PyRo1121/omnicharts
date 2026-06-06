/** Build public API CSV export URLs (Phase 4 — same rollups as JSON). */
export function rankingsChannelsCsvUrl(platform: string, period: string, limit = 20, language?: string | null): string {
	const q = new URLSearchParams({
		platform,
		period,
		limit: String(limit),
		format: 'csv',
	});
	if (language) q.set('language', language);
	return `/api/v1/rankings/channels?${q}`;
}

export function rankingsGamesCsvUrl(platform: string, period: string, limit = 20): string {
	const q = new URLSearchParams({
		platform,
		period,
		limit: String(limit),
		format: 'csv',
	});
	return `/api/v1/rankings/games?${q}`;
}

export function channelDetailCsvUrl(slug: string, platform: string, period: string): string {
	const q = new URLSearchParams({ platform, period, format: 'csv' });
	return `/api/v1/channels/${encodeURIComponent(slug)}?${q}`;
}
