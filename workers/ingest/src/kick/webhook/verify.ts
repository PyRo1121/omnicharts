/**
 * Kick webhook RSA signature verification (Workers / Web Crypto).
 * @see https://docs.kick.com/events/webhook-security
 */

let cachedKey: CryptoKey | null = null;
let cachedKeyPem: string | null = null;

function pemToSpkiBytes(pem: string): Uint8Array {
	const b64 = pem
		.replace(/-----BEGIN PUBLIC KEY-----/g, '')
		.replace(/-----END PUBLIC KEY-----/g, '')
		.replace(/\s/g, '');
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function importRsaPublicKey(pem: string): Promise<CryptoKey | null> {
	if (cachedKey && cachedKeyPem === pem) return cachedKey;
	try {
		const key = await crypto.subtle.importKey(
			'spki',
			pemToSpkiBytes(pem),
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['verify']
		);
		cachedKey = key;
		cachedKeyPem = pem;
		return key;
	} catch {
		return null;
	}
}

/** message_id.timestamp.rawBody — Kick webhook signed payload string. */
export function buildKickWebhookSignedPayload(
	messageId: string,
	timestamp: string,
	rawBody: string
): string {
	return `${messageId}.${timestamp}.${rawBody}`;
}

export async function verifyKickWebhookSignature(opts: {
	publicKeyPem: string;
	messageId: string;
	timestamp: string;
	signatureHeader: string;
	rawBody: string;
}): Promise<boolean> {
	const { publicKeyPem, messageId, timestamp, signatureHeader, rawBody } = opts;
	if (!publicKeyPem.trim() || !messageId || !timestamp || !signatureHeader) return false;

	const publicKey = await importRsaPublicKey(publicKeyPem.trim());
	if (!publicKey) return false;

	let signatureBytes: Uint8Array;
	try {
		const binary = atob(signatureHeader);
		signatureBytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) signatureBytes[i] = binary.charCodeAt(i);
	} catch {
		return false;
	}

	const payload = buildKickWebhookSignedPayload(messageId, timestamp, rawBody);
	return crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		publicKey,
		signatureBytes,
		new TextEncoder().encode(payload)
	);
}

export function clearKickWebhookKeyCacheForTests(): void {
	cachedKey = null;
	cachedKeyPem = null;
}
