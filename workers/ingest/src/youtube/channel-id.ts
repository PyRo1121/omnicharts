/** YouTube channel id — `UC` + 22 base64url chars (24 total). @see docs/16-search-and-resolution.md */
const YOUTUBE_CHANNEL_ID_RE = /^UC[\w-]{22}$/i;

export function isYoutubeChannelId(value: string): boolean {
	return YOUTUBE_CHANNEL_ID_RE.test(value.trim());
}

export function normalizeYoutubeHandle(raw: string): string {
	return raw.trim().replace(/^@+/, '').toLowerCase();
}

/** Exact handle / UC id queries only — no substring search API burn. */
export function shouldTryYoutubeApiSeed(query: string): boolean {
	const q = normalizeSearchQueryForYoutube(query);
	if (q.length < 2) return false;
	if (isYoutubeChannelId(q)) return true;
	return /^[a-z0-9._-]{2,64}$/.test(q);
}

function normalizeSearchQueryForYoutube(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ').replace(/^@+/, '').trim().toLowerCase();
}
