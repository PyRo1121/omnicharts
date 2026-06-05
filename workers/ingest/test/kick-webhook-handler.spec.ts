import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { handleKickWebhook } from '../src/kick/webhook/handler';
import { buildKickWebhookSignedPayload } from '../src/kick/webhook/verify';
import * as ingestLog from '../src/log';

async function generateTestRsaKeyPair(): Promise<{ publicPem: string; privateKey: CryptoKey }> {
	const { publicKey, privateKey } = await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true,
		['sign', 'verify']
	);
	const spki = await crypto.subtle.exportKey('spki', publicKey);
	const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
	const lines = b64.match(/.{1,64}/g) ?? [];
	const publicPem = `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
	return { publicPem, privateKey };
}

async function signedKickRequest(
	opts: {
		body: string;
		eventType?: string;
		messageId?: string;
		timestamp?: string;
		tamperSignature?: boolean;
	},
	keys: { publicPem: string; privateKey: CryptoKey }
): Promise<Request> {
	const messageId = opts.messageId ?? '01JMSG001';
	const timestamp = opts.timestamp ?? new Date().toISOString();
	const rawBody = opts.body;
	const payload = buildKickWebhookSignedPayload(messageId, timestamp, rawBody);
	const sig = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		keys.privateKey,
		new TextEncoder().encode(payload)
	);
	const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

	return new Request('http://localhost/webhooks/kick/events', {
		method: 'POST',
		headers: {
			'Kick-Event-Message-Id': messageId,
			'Kick-Event-Message-Timestamp': timestamp,
			'Kick-Event-Signature': opts.tamperSignature ? 'invalid' : signature,
			'Kick-Event-Type': opts.eventType ?? 'livestream.status.updated',
			'Kick-Event-Version': '1',
			'Kick-Event-Subscription-Id': '01JSUB001'
		},
		body: rawBody
	});
}

describe('handleKickWebhook', () => {
	let keys: { publicPem: string; privateKey: CryptoKey };
	const metadata = new Map<string, string>();

	const env = {
		KICK_WEBHOOK_PUBLIC_KEY: '',
		DB: {
			prepare(q: string) {
				return {
					bind: (...args: unknown[]) => ({
						run: async () => {
							if (q.includes('INSERT INTO ingest_metadata')) {
								metadata.set(String(args[0]), String(args[1]));
							}
							return {};
						},
						first: async () => {
							if (q.includes('ingest_metadata')) {
								const key = String(args[0]);
								const value = metadata.get(key);
								return value ? { value } : null;
							}
							if (q.includes('SELECT id FROM channels')) {
								return { id: 'kick-ch-123' };
							}
							return null;
						}
					})
				};
			}
		}
	} as unknown as Env;

	beforeAll(async () => {
		keys = await generateTestRsaKeyPair();
		env.KICK_WEBHOOK_PUBLIC_KEY = keys.publicPem;
	});

	beforeEach(() => {
		vi.restoreAllMocks();
		metadata.clear();
	});

	it('503 when KICK_WEBHOOK_PUBLIC_KEY missing', async () => {
		const res = await handleKickWebhook(
			new Request('http://x', { method: 'POST' }),
			{} as Env
		);
		expect(res.status).toBe(503);
	});

	it('400 when Kick webhook headers missing', async () => {
		const res = await handleKickWebhook(
			new Request('http://x', { method: 'POST', body: '{}' }),
			env
		);
		expect(res.status).toBe(400);
	});

	it('401 for invalid signature', async () => {
		const body = JSON.stringify({ is_live: true });
		const req = await signedKickRequest({ body, tamperSignature: true }, keys);
		const res = await handleKickWebhook(req, env);
		expect(res.status).toBe(401);
	});

	it('204 for livestream.status.updated stream online', async () => {
		const body = JSON.stringify({
			broadcaster: {
				user_id: 123,
				username: 'caster',
				channel_slug: 'caster'
			},
			is_live: true,
			title: 'Live now',
			started_at: '2026-06-01T12:00:00Z',
			ended_at: null
		});
		const req = await signedKickRequest({ body }, keys);
		const res = await handleKickWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 for livestream.status.updated stream offline', async () => {
		const body = JSON.stringify({
			broadcaster: {
				user_id: 123,
				username: 'caster',
				channel_slug: 'caster'
			},
			is_live: false,
			title: 'Was live',
			started_at: '2026-06-01T12:00:00Z',
			ended_at: '2026-06-01T15:00:00Z'
		});
		const req = await signedKickRequest({ body, messageId: '01JMSG002' }, keys);
		const res = await handleKickWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 and warns for unsupported event type', async () => {
		const warn = vi.spyOn(ingestLog, 'ingestWarn').mockImplementation(() => {});
		const body = JSON.stringify({ chat: true });
		const req = await signedKickRequest(
			{ body, eventType: 'chat.message.sent', messageId: '01JMSG003' },
			keys
		);
		const res = await handleKickWebhook(req, env);
		expect(res.status).toBe(204);
		expect(warn).toHaveBeenCalled();
	});

	it('204 duplicate message_id without re-processing', async () => {
		const body = JSON.stringify({
			broadcaster: { user_id: 99, channel_slug: 'dup' },
			is_live: true,
			started_at: '2026-06-01T12:00:00Z'
		});
		const req1 = await signedKickRequest({ body, messageId: '01JDUP001' }, keys);
		const req2 = await signedKickRequest({ body, messageId: '01JDUP001' }, keys);
		const first = await handleKickWebhook(req1, env);
		const second = await handleKickWebhook(req2, env);
		expect(first.status).toBe(204);
		expect(second.status).toBe(204);
	});
});
