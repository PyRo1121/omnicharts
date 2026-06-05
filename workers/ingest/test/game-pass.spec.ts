import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TwitchHelixClient } from '../src/twitch/helix';
import * as topGamesCache from '../src/twitch/top-games-cache';
import { runTwitchGamePass } from '../src/twitch/game-pass';

vi.mock('../src/twitch/ingest-stream', () => ({
	ingestHelixStreamsBatch: vi.fn().mockResolvedValue([]),
	flushSampleArchivePage: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../src/twitch/auth', () => ({
	getAppAccessToken: vi.fn().mockResolvedValue('test-token')
}));

vi.mock('../src/db/twitch', () => ({
	upsertGameCategory: vi.fn().mockResolvedValue('game-1')
}));

describe('runTwitchGamePass', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns early when no top games', async () => {
		vi.spyOn(topGamesCache, 'resolveTopGamesForCoverage').mockResolvedValue({
			games: [],
			helixPointsUsed: 0
		});
		const stats = await runTwitchGamePass({ TWITCH_MIN_VIEWERS: '2', DB: {} } as Env);
		expect(stats.gamesScanned).toBe(0);
	});

	it('ingests streams from rotating game slice', async () => {
		vi.spyOn(topGamesCache, 'resolveTopGamesForCoverage').mockResolvedValue({
			games: [{ id: 'g1', name: 'G1', box_art_url: '' }],
			helixPointsUsed: 0
		});
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockResolvedValue({
			data: [
				{
					id: 's1',
					user_id: 'u1',
					user_login: 'u1',
					user_name: 'U1',
					game_id: 'g1',
					game_name: 'G1',
					title: 'T',
					viewer_count: 100,
					started_at: '2026-06-01T00:00:00Z',
					type: 'live'
				}
			],
			pagination: {}
		});

		const stats = await runTwitchGamePass({ TWITCH_MIN_VIEWERS: '2', DB: {} } as Env);
		expect(stats.gamesScanned).toBeGreaterThan(0);
		expect(stats.channelsIngested).toBeGreaterThan(0);
	});

	it('skips empty pages when Helix returns a cursor', async () => {
		vi.spyOn(topGamesCache, 'resolveTopGamesForCoverage').mockResolvedValue({
			games: [{ id: 'g1', name: 'G1', box_art_url: '' }],
			helixPointsUsed: 0
		});
		let call = 0;
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockImplementation(async () => {
			call++;
			if (call === 1) {
				return { data: [], pagination: { cursor: 'skip-empty' } };
			}
			return {
				data: [
					{
						id: 's1',
						user_id: 'u1',
						user_login: 'u1',
						user_name: 'U1',
						game_id: 'g1',
						game_name: 'G1',
						title: 'T',
						viewer_count: 100,
						started_at: '2026-06-01T00:00:00Z',
						type: 'live'
					}
				],
				pagination: {}
			};
		});

		const stats = await runTwitchGamePass({
			TWITCH_MIN_VIEWERS: '2',
			GAME_PASS_GAMES_PER_CYCLE: '1',
			DB: {}
		} as Env);
		expect(stats.pagesFetched).toBe(2);
		expect(stats.channelsIngested).toBe(1);
	});

	it('paginates until below min viewers', async () => {
		vi.spyOn(topGamesCache, 'resolveTopGamesForCoverage').mockResolvedValue({
			games: [{ id: 'g1', name: 'G1', box_art_url: '' }],
			helixPointsUsed: 0
		});
		let page = 0;
		const getStreams = vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockImplementation(async () => {
			page++;
			if (page === 1) {
				return {
					data: [
						{
							id: 's1',
							user_id: 'u1',
							user_login: 'u1',
							user_name: 'U1',
							game_id: 'g1',
							game_name: 'G1',
							title: 'T',
							viewer_count: 1,
							started_at: '2026-06-01T00:00:00Z',
							type: 'live'
						}
					],
					pagination: { cursor: 'next' }
				};
			}
			return { data: [], pagination: {} };
		});

		const stats = await runTwitchGamePass({
			TWITCH_MIN_VIEWERS: '50',
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'sec',
			DB: {}
		} as Env);
		expect(getStreams).toHaveBeenCalled();
		expect(stats.pagesFetched).toBeGreaterThanOrEqual(1);
	});

	it('skips streams already seen in a shared sweep/game-pass cycle', async () => {
		vi.spyOn(topGamesCache, 'resolveTopGamesForCoverage').mockResolvedValue({
			games: [{ id: 'g1', name: 'G1', box_art_url: '' }],
			helixPointsUsed: 0
		});
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockResolvedValue({
			data: [
				{
					id: 's1',
					user_id: 'u1',
					user_login: 'u1',
					user_name: 'U1',
					game_id: 'g1',
					game_name: 'G1',
					title: 'T',
					viewer_count: 100,
					started_at: '2026-06-01T00:00:00Z',
					type: 'live'
				}
			],
			pagination: {}
		});

		const seenUserIds = new Set(['u1']);
		const stats = await runTwitchGamePass(
			{
				TWITCH_MIN_VIEWERS: '2',
				GAME_PASS_GAMES_PER_CYCLE: '1',
				DB: {}
			} as Env,
			{ seenUserIds }
		);
		expect(stats.duplicatesSkipped).toBe(1);
		expect(stats.channelsIngested).toBe(0);
	});
});
