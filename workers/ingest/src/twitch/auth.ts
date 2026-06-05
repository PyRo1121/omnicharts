import { parseOAuthTokenResponse } from '../json-guards';
import type { HelixRateBudget } from './rate-limit';

type TokenCache = {
	accessToken: string;
	expiresAtMs: number;
};

let cached: TokenCache | null = null;

export async function getAppAccessToken(env: Env, _budget: HelixRateBudget): Promise<string> {
	const now = Date.now();
	if (cached && cached.expiresAtMs > now + 60_000) {
		return cached.accessToken;
	}

	if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
		throw new Error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET');
	}

	const body = new URLSearchParams({
		client_id: env.TWITCH_CLIENT_ID,
		client_secret: env.TWITCH_CLIENT_SECRET,
		grant_type: 'client_credentials',
	});

	const res = await fetch('https://id.twitch.tv/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Twitch token failed ${res.status}: ${text.slice(0, 200)}`);
	}

	const data = parseOAuthTokenResponse(await res.json());
	cached = {
		accessToken: data.access_token,
		expiresAtMs: now + data.expires_in * 1000,
	};
	return cached.accessToken;
}

export function clearTokenCacheForTests(): void {
	cached = null;
}
