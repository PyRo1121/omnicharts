const SIGHTING_WINDOW_DAYS = 14;
const PROMOTION_MIN_SIGHTINGS = 2;

const nowIso = () => new Date().toISOString();

function windowStartIso(): string {
	const ms = Date.now() - SIGHTING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	return new Date(ms).toISOString();
}

/** Record a qualifying live hit (caller checks viewer threshold). */
export async function recordChannelLiveSighting(db: D1Database, channelId: string, viewerCount: number): Promise<void> {
	const now = nowIso();
	await db
		.prepare(
			`INSERT INTO channel_live_sightings (channel_id, sighted_at, viewer_count)
       VALUES (?, ?, ?)
       ON CONFLICT(channel_id, sighted_at) DO NOTHING`,
		)
		.bind(channelId, now, viewerCount)
		.run();

	await db
		.prepare(
			`DELETE FROM channel_live_sightings
       WHERE channel_id = ? AND sighted_at < ?`,
		)
		.bind(channelId, windowStartIso())
		.run();
}

/** Count live sightings in rolling 14d window (docs/12 promotion rule). */
export async function countChannelLiveSightings14d(db: D1Database, channelId: string): Promise<number> {
	const row = await db
		.prepare(
			`SELECT COUNT(*) AS n FROM channel_live_sightings
       WHERE channel_id = ? AND sighted_at >= ?`,
		)
		.bind(channelId, windowStartIso())
		.first<{ n: number }>();

	return row?.n ?? 0;
}

export function shouldPromoteDiscoveredToTracked(sightingCount: number): boolean {
	return sightingCount >= PROMOTION_MIN_SIGHTINGS;
}
