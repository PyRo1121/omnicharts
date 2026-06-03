import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TwitchHelixClient } from '../src/twitch/helix';
import { runTwitchLiveSweep } from '../src/twitch/sweep';
import { runTwitchDiscovery } from '../src/twitch/discover';

vi.mock('../src/twitch/ingest-stream', () => ({
	ingestHelixStream: vi.fn().mockResolvedValue(undefined),
	flushSampleArchivePage: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../src/db/twitch', () => ({
	upsertGameCategory: vi.fn().mockResolvedValue('game-1')
}));

vi.mock('../src/twitch/enrich-profiles', () => ({
	runTwitchProfileEnrichment: vi.fn().mockResolvedValue({ updated: 0 })
}));

vi.mock('../src/twitch/top-games-cache', () => ({
	writeCachedTopGames: vi.fn().mockResolvedValue(undefined)
}));

const helixStream = (userId: string, viewers: number) => ({
	id: `s-${userId}`,
	user_id: userId,
	user_login: userId,
	user_name: userId,
	game_id: '1',
	game_name: 'G',
	title: 'T',
	viewer_count: viewers,
	started_at: '2026-06-01T00:00:00Z',
	type: 'live'
});

describe('runTwitchLiveSweep', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('stops when page max viewers below threshold', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockResolvedValue({
			data: [helixStream('u1', 1)],
			pagination: {}
		});

		const stats = await runTwitchLiveSweep(
			{ TWITCH_MIN_VIEWERS: '10', DB: {} } as Env,
			{ maxPages: 3 }
		);
		expect(stats.stoppedBecause).toBe('below_threshold');
		expect(stats.pagesFetched).toBe(1);
	});

	it('stops at end of catalog when no cursor', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockResolvedValue({
			data: [helixStream('u1', 100)],
			pagination: {}
		});

		const stats = await runTwitchLiveSweep(
			{ TWITCH_MIN_VIEWERS: '2', DB: {} } as Env,
			{ maxPages: 5 }
		);
		expect(stats.stoppedBecause).toBe('end_of_catalog');
	});

	it('stops on empty first page', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockResolvedValue({
			data: [],
			pagination: {}
		});
		const stats = await runTwitchLiveSweep({ TWITCH_MIN_VIEWERS: '2', DB: {} } as Env);
		expect(stats.stoppedBecause).toBe('end_of_catalog');
		expect(stats.pagesFetched).toBe(1);
	});

	it('hits max_pages when cursor keeps going', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockResolvedValue({
			data: [helixStream('u1', 100)],
			pagination: { cursor: 'more' }
		});
		const stats = await runTwitchLiveSweep(
			{ TWITCH_MIN_VIEWERS: '2', DB: {} } as Env,
			{ maxPages: 1 }
		);
		expect(stats.stoppedBecause).toBe('max_pages');
	});
});

describe('runTwitchDiscovery quick mode', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('scans limited games/pages in quick mode', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getTopGames').mockResolvedValue([
			{ id: 'g1', name: 'Game 1', box_art_url: '' },
			{ id: 'g2', name: 'Game 2', box_art_url: '' }
		]);
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockResolvedValue({
			data: [helixStream('u1', 50)],
			pagination: {}
		});

		const stats = await runTwitchDiscovery({ TWITCH_MIN_VIEWERS: '2', DB: {} } as Env, {
			quick: true
		});
		expect(stats.gamesScanned).toBe(2);
		expect(stats.pagesFetched).toBeGreaterThan(0);
	});

	it('logs non-fatal enrichment errors in full mode', async () => {
		const topGamesCache = await import('../src/twitch/top-games-cache');
		vi.spyOn(topGamesCache, 'writeCachedTopGames').mockResolvedValue(undefined);
		vi.spyOn(TwitchHelixClient.prototype, 'getTopGames').mockResolvedValue([
			{ id: 'g1', name: 'G1', box_art_url: '' }
		]);
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockResolvedValue({
			data: [helixStream('u1', 50)],
			pagination: {}
		});
		const enrich = await import('../src/twitch/enrich-profiles');
		vi.spyOn(enrich, 'runTwitchProfileEnrichment').mockRejectedValue(new Error('enrich fail'));

		const stats = await runTwitchDiscovery({ TWITCH_MIN_VIEWERS: '2', DB: {} } as Env, {
			quick: false
		});
		expect(stats.gamesScanned).toBeGreaterThan(0);
	});
});
