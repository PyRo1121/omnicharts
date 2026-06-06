import { describe, it, expect } from 'vitest';
import { testEnv, TEST_ENV_NO_TWITCH_CREDS } from './helpers';
import { hasTwitchAppCredentials, twitchAppCredentialsErrorResponse } from '../src/twitch/credentials';

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null;
}

describe('twitch app credentials', () => {
	it('detects configured env', () => {
		expect(
			hasTwitchAppCredentials(
				testEnv({
					TWITCH_CLIENT_ID: 'id',
					TWITCH_CLIENT_SECRET: 'secret',
				}),
			),
		).toBe(true);
	});

	it('detects missing env', () => {
		expect(hasTwitchAppCredentials(testEnv(TEST_ENV_NO_TWITCH_CREDS))).toBe(false);
	});

	it('error response includes restart hint', async () => {
		const res = twitchAppCredentialsErrorResponse();
		expect(res.status).toBe(503);
		await expect(res.json()).resolves.toSatisfy((body: unknown) => {
			if (!isRecord(body)) return false;
			return typeof body.hint === 'string' && /restart/i.test(body.hint) && body.dev_vars === 'workers/ingest/.dev.vars';
		});
	});
});
