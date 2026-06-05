import { isValidTwitchEventSubSecret, twitchEventSubSecretLengthMessage } from './secret';

export function isEventSubConfigured(env: Env): env is Env & {
	TWITCH_EVENTSUB_SECRET: string;
	TWITCH_EVENTSUB_CALLBACK_URL: string;
} {
	const secret = env.TWITCH_EVENTSUB_SECRET?.trim();
	const callback = env.TWITCH_EVENTSUB_CALLBACK_URL?.trim();
	return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET && isValidTwitchEventSubSecret(secret) && callback);
}

export function eventSubConfigError(env: Env): string {
	const secret = env.TWITCH_EVENTSUB_SECRET?.trim();
	const callback = env.TWITCH_EVENTSUB_CALLBACK_URL?.trim();
	if (!secret || !callback) {
		return 'Missing TWITCH_EVENTSUB_SECRET and/or TWITCH_EVENTSUB_CALLBACK_URL in workers/ingest/.dev.vars (restart wrangler dev after editing)';
	}
	if (!isValidTwitchEventSubSecret(secret)) {
		return twitchEventSubSecretLengthMessage(secret.length);
	}
	return 'EventSub not configured';
}
