import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HelixGame } from '../src/twitch/helix';
import {
	readCachedTopGames,
	resolveTopGamesForCoverage,
	TOP_GAMES_CACHE_TTL_MS,
	TWITCH_TOP_GAMES_CACHE_KEY,
	writeCachedTopGames,
} from '../src/twitch/top-games-cache';
import { TwitchHelixClient } from '../src/twitch/helix';

const sampleGames: HelixGame[] = [{ id: '509658', name: 'Just Chatting', box_art_url: '' }];

function metadataDb(value: string | null) {
	return {
		prepare(sql: string) {
			return {
				bind: (key: string) => ({
					first: async () => {
						if (sql.includes('ingest_metadata') && key === TWITCH_TOP_GAMES_CACHE_KEY) {
							return value ? { value } : null;
						}
						return null;
					},
					run: async () => ({}),
				}),
			};
		},
	} as unknown as D1Database;
}

describe('top games cache', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns null when cache missing or expired', async () => {
		expect(await readCachedTopGames(metadataDb(null))).toBeNull();

		const stale = JSON.stringify({
			cachedAt: new Date(Date.now() - TOP_GAMES_CACHE_TTL_MS - 1).toISOString(),
			games: sampleGames,
		});
		expect(await readCachedTopGames(metadataDb(stale))).toBeNull();
	});

	it('reads fresh cache', async () => {
		const fresh = JSON.stringify({
			cachedAt: new Date().toISOString(),
			games: sampleGames,
		});
		const games = await readCachedTopGames(metadataDb(fresh));
		expect(games).toEqual(sampleGames);
	});

	it('resolveTopGamesForCoverage uses cache without Helix call', async () => {
		const fresh = JSON.stringify({
			cachedAt: new Date().toISOString(),
			games: sampleGames,
		});
		const getTopGames = vi.spyOn(TwitchHelixClient.prototype, 'getTopGames');
		const client = new TwitchHelixClient({} as Env);

		const result = await resolveTopGamesForCoverage(client, metadataDb(fresh), 100);
		expect(result.helixPointsUsed).toBe(0);
		expect(result.games).toEqual(sampleGames);
		expect(getTopGames).not.toHaveBeenCalled();
	});

	it('resolveTopGamesForCoverage fetches and writes cache on miss', async () => {
		const writes: string[] = [];
		const db = {
			prepare(sql: string) {
				return {
					bind: (key: string, value: string) => ({
						first: async () => null,
						run: async () => {
							if (sql.includes('INSERT INTO ingest_metadata')) {
								writes.push(key);
								expect(JSON.parse(value).games).toEqual(sampleGames);
							}
						},
					}),
				};
			},
		} as unknown as D1Database;

		vi.spyOn(TwitchHelixClient.prototype, 'getTopGames').mockResolvedValue(sampleGames);
		const client = new TwitchHelixClient({} as Env);

		const result = await resolveTopGamesForCoverage(client, db, 100);
		expect(result.helixPointsUsed).toBe(1);
		expect(result.games).toEqual(sampleGames);
		expect(writes).toEqual([TWITCH_TOP_GAMES_CACHE_KEY]);
	});

	it('writeCachedTopGames skips empty arrays', async () => {
		const run = vi.fn();
		const db = {
			prepare: () => ({ bind: () => ({ run }) }),
		} as unknown as D1Database;
		await writeCachedTopGames(db, []);
		expect(run).not.toHaveBeenCalled();
	});
});
