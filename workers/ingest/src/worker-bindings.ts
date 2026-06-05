/** Runtime guards for optional Wrangler bindings (tsc-safe call sites). */

export function requireDb(env: Env): D1Database {
	if (!env.DB) throw new Error('Missing DB binding');
	return env.DB;
}

export function requireIngestQueue(env: Env): Queue {
	if (!env.INGEST_QUEUE) throw new Error('Missing INGEST_QUEUE binding');
	return env.INGEST_QUEUE;
}

export function twitchClientId(env: Env): string {
	const id = env.TWITCH_CLIENT_ID;
	if (!id) throw new Error('Missing TWITCH_CLIENT_ID');
	return id;
}
