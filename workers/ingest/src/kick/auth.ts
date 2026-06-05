import { parseOAuthTokenResponse } from '../json-guards';

type TokenCache = {
	accessToken: string;
	expiresAtMs: number;
};

let cached: TokenCache | null = null;

export async function getKickAppAccessToken(env: Env): Promise<string> {
	const now = Date.now();
	if (cached && cached.expiresAtMs > now + 60_000) {
		return cached.accessToken;
	}

	if (!env.KICK_CLIENT_ID?.trim() || !env.KICK_CLIENT_SECRET?.trim()) {
		throw new Error('Missing KICK_CLIENT_ID or KICK_CLIENT_SECRET');
	}

	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: env.KICK_CLIENT_ID,
		client_secret: env.KICK_CLIENT_SECRET,
	});

	const res = await fetch('https://id.kick.com/oauth/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Kick token failed ${res.status}: ${text.slice(0, 200)}`);
	}

	const data = parseOAuthTokenResponse(await res.json());
	cached = {
		accessToken: data.access_token,
		expiresAtMs: now + data.expires_in * 1000,
	};
	return cached.accessToken;
}

export function invalidateKickTokenCache(): void {
	cached = null;
}

export function clearKickTokenCacheForTests(): void {
	invalidateKickTokenCache();
}
