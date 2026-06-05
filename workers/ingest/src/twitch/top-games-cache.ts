import type { HelixGame, TwitchHelixClient } from './helix';

export const TWITCH_TOP_GAMES_CACHE_KEY = 'twitch_top_games';

/** Align with 6h discovery cron — avoids GET /games/top on every game-pass minute. */
export const TOP_GAMES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CachedTopGames = {
	cachedAt: string;
	games: HelixGame[];
};

export async function readCachedTopGames(db: D1Database): Promise<HelixGame[] | null> {
	const row = await db
		.prepare(`SELECT value FROM ingest_metadata WHERE key = ?`)
		.bind(TWITCH_TOP_GAMES_CACHE_KEY)
		.first<{ value: string }>();
	if (!row?.value) return null;
	try {
		const parsed = JSON.parse(row.value) as CachedTopGames;
		if (!parsed.cachedAt || !Array.isArray(parsed.games)) return null;
		const age = Date.now() - Date.parse(parsed.cachedAt);
		if (!Number.isFinite(age) || age > TOP_GAMES_CACHE_TTL_MS) return null;
		return parsed.games;
	} catch {
		return null;
	}
}

export async function writeCachedTopGames(db: D1Database, games: HelixGame[]): Promise<void> {
	if (games.length === 0) return;
	const payload: CachedTopGames = {
		cachedAt: new Date().toISOString(),
		games
	};
	await db
		.prepare(
			`INSERT INTO ingest_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
		)
		.bind(TWITCH_TOP_GAMES_CACHE_KEY, JSON.stringify(payload))
		.run();
}

/** Cached top games when fresh; otherwise one Helix GET /games/top and cache write. */
export async function resolveTopGamesForCoverage(
	client: TwitchHelixClient,
	db: D1Database,
	first: number
): Promise<{ games: HelixGame[]; helixPointsUsed: number }> {
	const cached = await readCachedTopGames(db);
	if (cached && cached.length > 0) {
		return { games: cached.slice(0, first), helixPointsUsed: 0 };
	}
	const games = await client.getTopGames(first);
	if (games.length > 0) {
		await writeCachedTopGames(db, games);
	}
	return { games, helixPointsUsed: 1 };
}
