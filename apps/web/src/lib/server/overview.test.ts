import { describe, it, expect, vi } from 'vitest';
import { loadKickOverview, loadOverview, loadYoutubeOverview } from './overview';
import { mockD1Batch, testLoadContext, testLoadContextWithDb } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

describe('loadOverview', () => {
	it('builds live stats from D1 batch without ingest fetch', async () => {
		const fetchFn = vi.fn();
		const db = mockD1Batch([
			{ results: [{ n: 900 }] },
			{ results: [{ n: 12 }] },
			{
				results: [
					{
						slug: 'alpha',
						display_name: 'Alpha',
						avatar_url: null,
						first_observed_at: '2026-01-01T00:00:00Z',
						hours_watched: 100,
						average_viewers: 10,
						airtime_minutes: 600,
						peak_viewers: 20
					}
				]
			},
			{
				results: [
					{
						slug: 'valorant',
						name: 'VALORANT',
						hours_watched: 200,
						average_viewers: 50
					}
				]
			}
		]);

		const load = await loadOverview(testLoadContextWithDb(fetchFn as typeof fetch, db));
		expect(load.source).toBe('live');
		expect(load.ingestStatus).toBe('ok');
		expect(load.topChannelName).toBe('Alpha');
		expect(load.topGameName).toBe('VALORANT');
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('builds live stats from health + rankings', async () => {
		const fetchFn = vi.fn().mockImplementation((url: string | URL) => {
			const u = String(url);
			if (u.endsWith('/health')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						status: 'ok',
						tracked_channels: { twitch: 1200, kick: 0, youtube: 0 },
						kick: 'missing_credentials',
						youtube: 'missing_credentials',
						channels_live: 300,
						channels_live_by_platform: { twitch: 42, kick: 200, youtube: 58 },
						discovery_new_24h: 5
					})
				});
			}
			if (u.includes('/v1/rankings/channels')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						updated_at: '2026-06-01T00:00:00Z',
						items: [
							{
								rank: 1,
								slug: 'alpha',
								display_name: 'Alpha',
								avatar_url: null,
								hours_watched: 100,
								average_viewers: 10
							}
						]
					})
				});
			}
			if (u.includes('/v1/rankings/games')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						updated_at: '2026-06-01T00:00:00Z',
						items: [
							{
								rank: 1,
								slug: 'valorant',
								name: 'VALORANT',
								average_viewers: 50,
								hours_watched: 200,
								box_art_url: null
							}
						]
					})
				});
			}
			return Promise.resolve({ ok: false, status: 404 });
		});

		const load = await loadOverview(testLoadContext(fetchFn as typeof fetch));
		expect(load.source).toBe('live');
		expect(load.ingestStatus).toBe('ok');
		expect(load.topChannelName).toBe('Alpha');
		expect(load.topGameName).toBe('VALORANT');
		expect(load.stats.some((s) => s.label === 'Channels tracked')).toBe(true);
		expect(load.stats.find((s) => s.label === 'Live now')?.value).toBe('42');
		expect(load.channelsLive).toBe(42);
	});

	it('returns unavailable when health fails (default)', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		const load = await loadOverview(testLoadContext(fetchFn as typeof fetch));
		expect(load.source).toBe('unavailable');
		expect(load.stats.every((s) => s.source === 'unavailable')).toBe(true);
	});

	it('returns mock stats when mockEnabled and health fails', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		const load = await loadOverview(testLoadContext(fetchFn as typeof fetch), true);
		expect(load.source).toBe('mock');
		expect(load.stats.every((s) => s.source === 'mock')).toBe(true);
	});
});

describe('loadKickOverview', () => {
	it('builds stats from kick rankings with ingest health when live', async () => {
		const fetchFn = vi.fn().mockImplementation((url: string | URL) => {
			const u = String(url);
			if (u.includes('/health')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						status: 'ok',
						tracked_channels: { twitch: 0, kick: 12, youtube: 0 },
						channels_live_by_platform: { twitch: 0, kick: 3, youtube: 0 }
					})
				});
			}
			if (u.includes('/v1/rankings/channels')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						updated_at: '2026-06-01T00:00:00Z',
						items: [
							{
								rank: 1,
								slug: 'xqc',
								display_name: 'xQc',
								avatar_url: null,
								hours_watched: 100,
								average_viewers: 10
							}
						]
					})
				});
			}
			if (u.includes('/v1/rankings/games')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						updated_at: '2026-06-01T00:00:00Z',
						items: [
							{
								rank: 1,
								slug: 'just-chatting',
								name: 'Just Chatting',
								average_viewers: 50,
								hours_watched: 200,
								box_art_url: null
							}
						]
					})
				});
			}
			return Promise.resolve({ ok: false, status: 404 });
		});

		const load = await loadKickOverview(testLoadContext(fetchFn as typeof fetch));
		expect(load.source).toBe('live');
		expect(load.ingestStatus).toBe('ok');
		expect(load.topChannelName).toBe('xQc');
		expect(load.topGameName).toBe('Just Chatting');
		expect(load.stats[0]?.source).toBe('live');
		expect(load.stats[0]?.value).toBe('12');
		expect(load.stats[1]?.value).toBe('3');
		expect(load.stats[2]?.value).toBe('1');
		expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('platform=kick'))).toBe(true);
		expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('/health'))).toBe(true);
	});
});

describe('loadYoutubeOverview', () => {
	it('builds stats from youtube rankings with ingest health when live', async () => {
		const fetchFn = vi.fn().mockImplementation((url: string | URL) => {
			const u = String(url);
			if (u.includes('/health')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						status: 'ok',
						tracked_channels: { twitch: 0, kick: 0, youtube: 8 },
						channels_live_by_platform: { twitch: 0, kick: 0, youtube: 2 }
					})
				});
			}
			if (u.includes('/v1/rankings/channels')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						updated_at: '2026-06-01T00:00:00Z',
						items: [
							{
								rank: 1,
								slug: 'mrbeast',
								display_name: 'MrBeast',
								avatar_url: null,
								hours_watched: 100,
								average_viewers: 10
							}
						]
					})
				});
			}
			if (u.includes('/v1/rankings/games')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						updated_at: '2026-06-01T00:00:00Z',
						items: []
					})
				});
			}
			return Promise.resolve({ ok: false, status: 404 });
		});

		const load = await loadYoutubeOverview(testLoadContext(fetchFn as typeof fetch));
		expect(load.source).toBe('live');
		expect(load.topChannelName).toBe('MrBeast');
		expect(load.stats[0]?.value).toBe('8');
		expect(load.stats[1]?.value).toBe('2');
		expect(load.stats[2]?.value).toBe('1');
		expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('platform=youtube'))).toBe(true);
		expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('/health'))).toBe(true);
	});
});
