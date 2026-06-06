import { describe, expect, it, vi } from 'vitest';
import { GET as getChannelRankings } from '../../routes/api/v1/rankings/channels/+server';
import { mockD1FromSql } from './mock-d1';
import { testAppPlatform, testRankingsChannelsRequest } from './test-helpers';

function mockD1WithRankings() {
	return mockD1FromSql((sql: string) => {
		const isRollup = sql.includes('channel_daily_rollups') || sql.includes('FROM channels');
		return {
			bind: (..._args: unknown[]) => ({
				first: async () => {
					if (sql.includes('slug_history')) return null;
					if (sql.includes('FROM channels') && !sql.includes('rollup')) {
						return {
							id: '1',
							slug: 'caedrel',
							display_name: 'Caedrel',
							avatar_url: null,
							first_observed_at: '2026-03-01T00:00:00Z',
							peak_viewers: 100,
							airtime_minutes: 120,
							stream_count: 1,
							hours_watched: 500,
							average_viewers: 50,
						};
					}
					return null;
				},
				all: async () => ({
					results: isRollup
						? [
								{
									slug: 'caedrel',
									display_name: 'Caedrel',
									avatar_url: null,
									first_observed_at: '2026-03-01T00:00:00Z',
									peak_viewers: 100,
									airtime_minutes: 120,
									stream_count: 1,
									hours_watched: 500,
									average_viewers: 50,
								},
							]
						: [],
				}),
			}),
		};
	});
}

describe('GET /api/v1/rankings/channels?format=csv', () => {
	it('returns text/csv with ranking header row', async () => {
		const db = mockD1WithRankings();
		const res = await getChannelRankings(
			testRankingsChannelsRequest({
				url: new URL('http://localhost/api/v1/rankings/channels?platform=twitch&period=7d&limit=20&format=csv'),
				fetch: vi.fn(),
				platform: testAppPlatform(db),
			}),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/csv');
		expect(res.headers.get('content-disposition')).toContain('omnicharts-twitch-channels-7d.csv');
		const text = await res.text();
		expect(text.split('\n')[0]).toContain('rank,slug,display_name');
	});

	it('returns invalid_format for unknown format', async () => {
		const res = await getChannelRankings(
			testRankingsChannelsRequest({
				url: new URL('http://localhost/api/v1/rankings/channels?platform=twitch&format=xlsx'),
				fetch: vi.fn(),
				platform: testAppPlatform(mockD1WithRankings()),
			}),
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: 'invalid_format', message: 'format must be json or csv' },
		});
	});
});
