/** App access token credentials (Helix + EventSub API), not EventSub webhook transport. */

export function hasTwitchAppCredentials(env: Env): boolean {
	return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
}

export function twitchAppCredentialsErrorResponse(): Response {
	return Response.json(
		{
			error: 'Twitch credentials not configured',
			hint:
				'Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in workers/ingest/.dev.vars (copy from .dev.vars.example). Restart local ingest after editing: stop wrangler dev, then bun run dev:ingest from the repo root. Wrangler reads .dev.vars only at startup.',
			dev_vars: 'workers/ingest/.dev.vars'
		},
		{ status: 503 }
	);
}
