import { describe, it, expect, vi } from 'vitest';
import { load as channelsLoad } from '../../routes/channels/+page.server';
import { load as gamesLoad } from '../../routes/games/+page.server';
import { expectPageData, testChannelsPageLoadEvent, testGamesPageLoadEvent } from './test-helpers';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' },
}));

function channelsLoadArgs(platform: string | null) {
	const url = new URL('http://localhost/channels');
	if (platform) url.searchParams.set('platform', platform);

	return testChannelsPageLoadEvent({
		fetch: vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				platform: 'youtube',
				period: '7d',
				updated_at: '2026-06-01T00:00:00Z',
				items: [],
			}),
		}),
		url,
		setHeaders: vi.fn(),
	});
}

function gamesLoadArgs(platform: string | null) {
	const url = new URL('http://localhost/games');
	if (platform) url.searchParams.set('platform', platform);

	return testGamesPageLoadEvent({
		fetch: vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				platform: 'youtube',
				period: '7d',
				updated_at: '2026-06-01T00:00:00Z',
				items: [],
			}),
		}),
		url,
		setHeaders: vi.fn(),
	});
}

describe('youtube platform page loads (docs/09 Phase 3)', () => {
	it('channels load accepts youtube platform filter', async () => {
		const result = expectPageData(await channelsLoad(channelsLoadArgs('youtube')));
		expect(result.platform).toBe('youtube');
		expect(result.rows).toHaveLength(0);
	});

	it('games load accepts youtube platform filter', async () => {
		const result = expectPageData(await gamesLoad(gamesLoadArgs('youtube')));
		expect(result.platform).toBe('youtube');
		expect(result.rows).toHaveLength(0);
	});
});
