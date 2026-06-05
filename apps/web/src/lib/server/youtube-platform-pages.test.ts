import { describe, it, expect, vi } from 'vitest';
import { load as channelsLoad } from '../../routes/channels/+page.server';
import { load as gamesLoad } from '../../routes/games/+page.server';
import type { PageData as ChannelsPageData } from '../../routes/channels/$types';
import type { PageData as GamesPageData } from '../../routes/games/$types';

vi.mock('$env/dynamic/private', () => ({
	env: { INGEST_URL: 'http://ingest.test' }
}));

type ChannelsLoad = (event: Parameters<typeof channelsLoad>[0]) => Promise<ChannelsPageData>;
type GamesLoad = (event: Parameters<typeof gamesLoad>[0]) => Promise<GamesPageData>;

const channelsPageLoad = channelsLoad as ChannelsLoad;
const gamesPageLoad = gamesLoad as GamesLoad;

function channelsLoadArgs(platform: string | null) {
	const url = new URL('http://localhost/channels');
	if (platform) url.searchParams.set('platform', platform);

	return {
		fetch: vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				platform: 'youtube',
				period: '7d',
				updated_at: '2026-06-01T00:00:00Z',
				items: []
			})
		}),
		url,
		setHeaders: vi.fn(),
		platform: undefined
	} as unknown as Parameters<typeof channelsLoad>[0];
}

function gamesLoadArgs(platform: string | null) {
	const url = new URL('http://localhost/games');
	if (platform) url.searchParams.set('platform', platform);

	return {
		fetch: vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				platform: 'youtube',
				period: '7d',
				updated_at: '2026-06-01T00:00:00Z',
				items: []
			})
		}),
		url,
		setHeaders: vi.fn(),
		platform: undefined
	} as unknown as Parameters<typeof gamesLoad>[0];
}

describe('youtube platform page loads (docs/09 Phase 3)', () => {
	it('channels load does not mark youtube as platformUnsupported', async () => {
		const result = await channelsPageLoad(channelsLoadArgs('youtube'));
		expect(result.platform).toBe('youtube');
		expect(result.platformUnsupported).toBe(false);
		expect(result.rows).toHaveLength(0);
	});

	it('games load does not mark youtube as platformUnsupported', async () => {
		const result = await gamesPageLoad(gamesLoadArgs('youtube'));
		expect(result.platform).toBe('youtube');
		expect(result.platformUnsupported).toBe(false);
		expect(result.rows).toHaveLength(0);
	});
});
