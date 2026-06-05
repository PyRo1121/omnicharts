/**
 * Twitch EventSub webhook signature verification (Workers / Web Crypto).
 * @see https://dev.twitch.tv/docs/eventsub/handling-webhook-events#verifying-the-event-message
 */

import { isValidTwitchEventSubSecret } from './secret';

const HMAC_PREFIX = 'sha256=';
const DEFAULT_MAX_SKEW_SECONDS = 600;

let cachedKey: CryptoKey | null = null;
let cachedKeySecret: string | null = null;

async function importHmacKey(secret: string): Promise<CryptoKey> {
	if (cachedKey && cachedKeySecret === secret) return cachedKey;
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify',
	]);
	cachedKey = key;
	cachedKeySecret = secret;
	return key;
}

function hexToBytes(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) return new Uint8Array(0);
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

/** message_id + timestamp + raw body (string concat order matters). */
export function buildEventSubHmacMessage(messageId: string, timestamp: string, rawBody: string): string {
	return messageId + timestamp + rawBody;
}

export function isEventSubTimestampFresh(timestamp: string, maxSkewSeconds = DEFAULT_MAX_SKEW_SECONDS): boolean {
	// Twitch-Eventsub-Message-Timestamp is RFC3339 (contains date-time separator).
	if (!timestamp.includes('T')) return false;
	const parsedMs = Date.parse(timestamp);
	if (!Number.isFinite(parsedMs)) return false;
	const ageSec = Math.abs(Date.now() - parsedMs) / 1000;
	return ageSec <= maxSkewSeconds;
}

/**
 * Compare Twitch-Eventsub-Message-Signature to HMAC-SHA256 of the message.
 * Uses crypto.subtle.verify (timing-safe per Web Crypto spec).
 */
export async function verifyTwitchEventSubSignature(opts: {
	secret: string;
	messageId: string;
	timestamp: string;
	signatureHeader: string;
	rawBody: string;
}): Promise<boolean> {
	const { secret, messageId, timestamp, signatureHeader, rawBody } = opts;
	if (!isValidTwitchEventSubSecret(secret)) return false;

	const hex = signatureHeader.startsWith(HMAC_PREFIX) ? signatureHeader.slice(HMAC_PREFIX.length) : signatureHeader;
	const signatureBytes = hexToBytes(hex);
	if (signatureBytes.length === 0) return false;

	const message = buildEventSubHmacMessage(messageId, timestamp, rawBody);
	const key = await importHmacKey(secret);

	return crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(message));
}

export function clearEventSubKeyCacheForTests(): void {
	cachedKey = null;
	cachedKeySecret = null;
}
