import { describe, it, expect, beforeAll } from 'vitest';
import { buildKickWebhookSignedPayload, clearKickWebhookKeyCacheForTests, verifyKickWebhookSignature } from '../src/kick/webhook/verify';

async function generateTestRsaKeyPair(): Promise<{ publicPem: string; privateKey: CryptoKey }> {
	const { publicKey, privateKey } = await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256',
		},
		true,
		['sign', 'verify'],
	);
	const spki = await crypto.subtle.exportKey('spki', publicKey);
	const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
	const lines = b64.match(/.{1,64}/g) ?? [];
	const publicPem = `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
	return { publicPem, privateKey };
}

async function signPayload(privateKey: CryptoKey, payload: string): Promise<string> {
	const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(payload));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

describe('kick webhook verify', () => {
	let publicPem: string;
	let privateKey: CryptoKey;

	beforeAll(async () => {
		const keys = await generateTestRsaKeyPair();
		publicPem = keys.publicPem;
		privateKey = keys.privateKey;
	});

	it('buildKickWebhookSignedPayload concatenates id timestamp body', () => {
		expect(buildKickWebhookSignedPayload('mid', '2026-06-01T00:00:00Z', '{"a":1}')).toBe('mid.2026-06-01T00:00:00Z.{"a":1}');
	});

	it('verifyKickWebhookSignature accepts valid RSA signature', async () => {
		clearKickWebhookKeyCacheForTests();
		const messageId = '01JABCDEF';
		const timestamp = '2026-06-01T12:00:00Z';
		const rawBody = '{"is_live":true}';
		const payload = buildKickWebhookSignedPayload(messageId, timestamp, rawBody);
		const signature = await signPayload(privateKey, payload);

		const ok = await verifyKickWebhookSignature({
			publicKeyPem: publicPem,
			messageId,
			timestamp,
			signatureHeader: signature,
			rawBody,
		});
		expect(ok).toBe(true);
	});

	it('verifyKickWebhookSignature rejects tampered body', async () => {
		clearKickWebhookKeyCacheForTests();
		const messageId = '01JABCDEF';
		const timestamp = '2026-06-01T12:00:00Z';
		const rawBody = '{"is_live":true}';
		const payload = buildKickWebhookSignedPayload(messageId, timestamp, rawBody);
		const signature = await signPayload(privateKey, payload);

		const ok = await verifyKickWebhookSignature({
			publicKeyPem: publicPem,
			messageId,
			timestamp,
			signatureHeader: signature,
			rawBody: '{"is_live":false}',
		});
		expect(ok).toBe(false);
	});
});
