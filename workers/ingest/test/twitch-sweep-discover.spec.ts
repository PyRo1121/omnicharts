import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv } from './helpers';
import { TwitchHelixClient } from '../src/twitch/helix';
import { runTwitchLiveSweep } from '../src/twitch/sweep';
import { runTwitchDiscovery } from '../src/twitch/discover';

vi.mock('../src/twitch/ingest-stream', () => ({
	ingestHelixStreamsBatch: vi.fn().mockResolvedValue([]),
	flushSampleArchivePage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/db/twitch', () => ({
	upsertGameCategory: vi.fn().mockResolvedValue('game-1'),
}));

vi.mock('../src/twitch/enrich-profiles', () => ({
	runTwitchProfileEnrichment: vi.fn().mockResolvedValue({ updated: 0 }),
}));

vi.mock('../src/twitch/top-games-cache', () => ({
	writeCachedTopGames: vi.fn().mockResolvedValue(undefined),
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
	type: 'live',
});

describe('runTwitchLiveSweep', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('stops when page max viewers below threshold', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockResolvedValue({
			data: [helixStream('u1', 1)],
			pagination: {},
		});

		const stats = await runTwitchLiveSweep(testEnv({ TWITCH_MIN_VIEWERS: '10' }), { maxPages: 3 });
		expect(stats.stoppedBecause).toBe('below_threshold');
		expect(stats.pagesFetched).toBe(1);
	});

	it('stops at end of catalog when no cursor', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockResolvedValue({
			data: [helixStream('u1', 100)],
			pagination: {},
		});

		const stats = await runTwitchLiveSweep(testEnv({ TWITCH_MIN_VIEWERS: '2' }), { maxPages: 5 });
		expect(stats.stoppedBecause).toBe('end_of_catalog');
	});

	it('stops on empty first page without cursor', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockResolvedValue({
			data: [],
			pagination: {},
		});
		const stats = await runTwitchLiveSweep(testEnv({ TWITCH_MIN_VIEWERS: '2' }));
		expect(stats.stoppedBecause).toBe('end_of_catalog');
		expect(stats.pagesFetched).toBe(1);
	});

	it('skips empty pages while cursor remains (up to guard)', async () => {
		let call = 0;
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockImplementation(async () => {
			call++;
			if (call <= 2) {
				return { data: [], pagination: { cursor: `empty-${call}` } };
			}
			return {
				data: [helixStream('u1', 100)],
				pagination: {},
			};
		});
		const stats = await runTwitchLiveSweep(testEnv({ TWITCH_MIN_VIEWERS: '2' }), { maxPages: 5 });
		expect(stats.pagesFetched).toBe(3);
		expect(stats.channelsIngested).toBe(1);
	});

	it('hits max_pages when cursor keeps going', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getLiveStreamsPage').mockResolvedValue({
			data: [helixStream('u1', 100)],
			pagination: { cursor: 'more' },
		});
		const stats = await runTwitchLiveSweep(testEnv({ TWITCH_MIN_VIEWERS: '2' }), { maxPages: 1 });
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
			{ id: 'g2', name: 'Game 2', box_art_url: '' },
		]);
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockResolvedValue({
			data: [helixStream('u1', 50)],
			pagination: {},
		});

		const stats = await runTwitchDiscovery(testEnv({ TWITCH_MIN_VIEWERS: '2' }), {
			quick: true,
		});
		expect(stats.gamesScanned).toBe(2);
		expect(stats.pagesFetched).toBeGreaterThan(0);
	});

	it('logs non-fatal enrichment errors in full mode', async () => {
		const ingestLog = await import('../src/log');
		const errorSpy = vi.spyOn(ingestLog, 'ingestNonFatalError').mockImplementation(() => {});
		const topGamesCache = await import('../src/twitch/top-games-cache');
		vi.spyOn(topGamesCache, 'writeCachedTopGames').mockResolvedValue(undefined);
		vi.spyOn(TwitchHelixClient.prototype, 'getTopGames').mockResolvedValue([{ id: 'g1', name: 'G1', box_art_url: '' }]);
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockResolvedValue({
			data: [helixStream('u1', 50)],
			pagination: {},
		});
		const enrich = await import('../src/twitch/enrich-profiles');
		vi.spyOn(enrich, 'runTwitchProfileEnrichment').mockRejectedValue(new Error('enrich fail'));

		const stats = await runTwitchDiscovery(testEnv({ TWITCH_MIN_VIEWERS: '2' }), {
			quick: false,
		});
		expect(stats.gamesScanned).toBeGreaterThan(0);
		expect(errorSpy).toHaveBeenCalledWith('discovery profile enrichment failed (non-fatal)', expect.any(Error));
	});

	it('skips empty game pages when cursor is present', async () => {
		vi.spyOn(TwitchHelixClient.prototype, 'getTopGames').mockResolvedValue([{ id: 'g1', name: 'G1', box_art_url: '' }]);
		let call = 0;
		vi.spyOn(TwitchHelixClient.prototype, 'getStreamsByGameId').mockImplementation(async () => {
			call++;
			if (call === 1) {
				return { data: [], pagination: { cursor: 'empty-skip' } };
			}
			return {
				data: [helixStream('u1', 50)],
				pagination: {},
			};
		});

		const stats = await runTwitchDiscovery(testEnv({ TWITCH_MIN_VIEWERS: '2' }), {
			quick: true,
		});
		expect(stats.pagesFetched).toBe(2);
		expect(stats.streamsSeen).toBeGreaterThan(0);
	});
});
