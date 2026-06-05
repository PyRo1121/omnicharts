import { describe, it, expect } from 'bun:test';
import {
	compareQueryErrorResponse,
	rankingsChannelsQueryErrorResponse,
	rankingsGamesQueryErrorResponse,
	searchQueryErrorResponse,
} from '../src/api-errors';

describe('api-errors', () => {
	it('rankingsChannelsQueryErrorResponse returns OpenAPI-shaped 400', async () => {
		const res = rankingsChannelsQueryErrorResponse('invalid_period');
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({
			error: {
				code: 'invalid_period',
				message: 'period must be one of 24h, 7d, 30d, 90d',
			},
		});
	});

	it('rankingsGamesQueryErrorResponse omits invalid_language', async () => {
		const res = rankingsGamesQueryErrorResponse('invalid_format');
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe('invalid_format');
	});

	it('compareQueryErrorResponse documents missing slugs', async () => {
		const res = compareQueryErrorResponse('missing_slugs');
		const body = await res.json();
		expect(body.error.message).toContain('a and b');
	});

	it('searchQueryErrorResponse uses no-store when requested', () => {
		const res = searchQueryErrorResponse('invalid_query', { cacheControl: 'no-store' });
		expect(res.headers.get('cache-control')).toBe('no-store');
	});
});
