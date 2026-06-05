import { describe, it, expect } from 'vitest';
import { hasTwitchAppCredentials, twitchAppCredentialsErrorResponse } from '../src/twitch/credentials';

describe('twitch app credentials', () => {
	it('detects configured env', () => {
		expect(
			hasTwitchAppCredentials({
				TWITCH_CLIENT_ID: 'id',
				TWITCH_CLIENT_SECRET: 'secret'
			} as Env)
		).toBe(true);
	});

	it('detects missing env', () => {
		expect(hasTwitchAppCredentials({} as Env)).toBe(false);
	});

	it('error response includes restart hint', async () => {
		const res = twitchAppCredentialsErrorResponse();
		expect(res.status).toBe(503);
		const body = (await res.json()) as { hint?: string; dev_vars?: string };
		expect(body.hint).toMatch(/restart/i);
		expect(body.dev_vars).toBe('workers/ingest/.dev.vars');
	});
});
