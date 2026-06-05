import { describe, it, expect } from 'vitest';
import { buildGameDetailResponse, parseGameDetailQuery } from '../src/ranking/game-api';

describe('game-api edge cases', () => {
	it('parseGameDetailQuery defaults platform and period', () => {
		const url = new URL('http://x/v1/games/valorant');
		const q = parseGameDetailQuery(url);
		expect(q.platform).toBe('twitch');
		expect(q.period).toBe('7d');
	});

	it('buildGameDetailResponse returns null for non-twitch platform', async () => {
		const db = {} as D1Database;
		const res = await buildGameDetailResponse(db, {
			platform: 'youtube',
			slug: 'valorant',
			period: '7d'
		});
		expect(res).toBeNull();
	});

	it('buildGameDetailResponse returns null for empty slug', async () => {
		const db = {} as D1Database;
		const res = await buildGameDetailResponse(db, {
			platform: 'twitch',
			slug: '',
			period: '7d'
		});
		expect(res).toBeNull();
	});
});
