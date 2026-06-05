import type { DiscoveryStats } from '../db/twitch';
import type { KickDiscoveryStats } from '../kick/discover';

export const DISCOVERY_SEED_KEY = 'discovery_seed_at';
export const KICK_DISCOVERY_SEED_KEY = 'kick_discovery_seed_at';

export async function recordKickDiscoverySeed(
	db: D1Database,
	stats: KickDiscoveryStats
): Promise<void> {
	const payload = JSON.stringify({
		at: new Date().toISOString(),
		categoriesScanned: stats.categoriesScanned,
		channelsUpserted: stats.channelsUpserted
	});

	await db.prepare(
		`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	)
		.bind(KICK_DISCOVERY_SEED_KEY, payload)
		.run();
}

export async function getKickDiscoverySeedAt(db: D1Database): Promise<string | null> {
	const row = await db.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`)
		.bind(KICK_DISCOVERY_SEED_KEY)
		.first<{ value: string }>();
	if (!row?.value) return null;
	try {
		const parsed = JSON.parse(row.value) as { at?: string };
		return parsed.at ?? row.value;
	} catch {
		return row.value;
	}
}

export async function recordDiscoverySeed(db: D1Database, stats: DiscoveryStats): Promise<void> {
	const payload = JSON.stringify({
		at: new Date().toISOString(),
		gamesScanned: stats.gamesScanned,
		channelsUpserted: stats.channelsUpserted
	});

	await db.prepare(
		`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	)
		.bind(DISCOVERY_SEED_KEY, payload)
		.run();
}

export async function getDiscoverySeedAt(db: D1Database): Promise<string | null> {
	const row = await db.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`)
		.bind(DISCOVERY_SEED_KEY)
		.first<{ value: string }>();
	if (!row?.value) return null;
	try {
		const parsed = JSON.parse(row.value) as { at?: string };
		return parsed.at ?? row.value;
	} catch {
		return row.value;
	}
}
