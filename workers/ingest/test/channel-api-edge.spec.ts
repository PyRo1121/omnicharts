import { describe, it, expect } from 'vitest';
import { buildChannelDetailResponse, parseChannelDetailQuery } from '../src/ranking/channel-api';

describe('channel-api edge cases', () => {
	it('parseChannelDetailQuery defaults platform and period', () => {
		const url = new URL('http://x/v1/channels/ninja');
		const q = parseChannelDetailQuery(url);
		expect(q.platform).toBe('twitch');
		expect(q.period).toBe('7d');
	});

	it('buildChannelDetailResponse returns null for non-twitch platform', async () => {
		const db = {} as D1Database;
		const res = await buildChannelDetailResponse(db, {
			platform: 'kick',
			slug: 'x',
			period: '7d'
		});
		expect(res).toBeNull();
	});

	it('buildChannelDetailResponse returns null for empty slug', async () => {
		const db = {} as D1Database;
		const res = await buildChannelDetailResponse(db, {
			platform: 'twitch',
			slug: '',
			period: '7d'
		});
		expect(res).toBeNull();
	});
});
