/** Twitch EventSub transport.secret length — https://dev.twitch.tv/docs/eventsub/ */
export const EVENTSUB_SECRET_MIN_LENGTH = 10;
export const EVENTSUB_SECRET_MAX_LENGTH = 100;

export function isValidTwitchEventSubSecret(secret: string | undefined | null): boolean {
	if (!secret) return false;
	const len = secret.length;
	return len >= EVENTSUB_SECRET_MIN_LENGTH && len <= EVENTSUB_SECRET_MAX_LENGTH;
}

export function twitchEventSubSecretLengthMessage(length: number): string {
	return `TWITCH_EVENTSUB_SECRET must be ${EVENTSUB_SECRET_MIN_LENGTH}–${EVENTSUB_SECRET_MAX_LENGTH} characters (Twitch transport.secret); got ${length}`;
}
