import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockIngestD1, testEnv } from './helpers';
import { handleTwitchEventSubWebhook } from '../src/twitch/eventsub/handler';
import { buildEventSubHmacMessage } from '../src/twitch/eventsub/verify';
import * as ingestLog from '../src/log';

const secret = 's3cre77890ab';

async function signedRequest(opts: {
	messageType: string;
	body: string;
	messageId?: string;
	timestamp?: string;
	tamperSignature?: boolean;
}): Promise<Request> {
	const messageId = opts.messageId ?? 'msg-id-1';
	const timestamp = opts.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, '.000000000Z');
	const rawBody = opts.body;

	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const message = buildEventSubHmacMessage(messageId, timestamp, rawBody);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
	const hex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return new Request('http://localhost/webhooks/twitch/eventsub', {
		method: 'POST',
		headers: {
			'twitch-eventsub-message-type': opts.messageType,
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': opts.tamperSignature ? 'sha256=00' : `sha256=${hex}`,
		},
		body: rawBody,
	});
}

describe('handleTwitchEventSubWebhook', () => {
	const metadata = new Map<string, string>();
	const env = testEnv({
		TWITCH_EVENTSUB_SECRET: secret,
		DB: mockIngestD1((q) => ({
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
						return { id: 'twitch-ch-123' };
					}
					return null;
				},
			}),
		})),
	});

	beforeEach(() => {
		vi.restoreAllMocks();
		metadata.clear();
	});

	it('503 when secret missing', async () => {
		const res = await handleTwitchEventSubWebhook(new Request('http://x', { method: 'POST' }), testEnv());
		expect(res.status).toBe(503);
	});

	it('400 when headers missing', async () => {
		const res = await handleTwitchEventSubWebhook(new Request('http://x', { method: 'POST', body: '{}' }), env);
		expect(res.status).toBe(400);
	});

	it('returns challenge for verification', async () => {
		const body = JSON.stringify({ challenge: 'hello-challenge' });
		const req = await signedRequest({ messageType: 'webhook_callback_verification', body });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe('hello-challenge');
	});

	it('403 for invalid signature', async () => {
		const req = await signedRequest({
			messageType: 'notification',
			body: '{}',
			tamperSignature: true,
		});
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(403);
	});

	it('204 for stream.online notification', async () => {
		const body = JSON.stringify({
			subscription: { type: 'stream.online' },
			event: {
				id: 'ev1',
				broadcaster_user_id: '123',
				broadcaster_user_login: 'user',
				broadcaster_user_name: 'User',
				started_at: '2026-06-01T00:00:00Z',
			},
		});
		const req = await signedRequest({ messageType: 'notification', body });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 for stream.offline notification', async () => {
		const body = JSON.stringify({
			subscription: { type: 'stream.offline' },
			event: {
				broadcaster_user_id: '123',
				broadcaster_user_login: 'user',
				broadcaster_user_name: 'User',
			},
		});
		const req = await signedRequest({ messageType: 'notification', body });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 for stream.online with invalid event fields', async () => {
		const body = JSON.stringify({
			subscription: { type: 'stream.online' },
			event: { broadcaster_user_id: '123' },
		});
		const req = await signedRequest({ messageType: 'notification', body });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 for stream.offline with invalid event fields', async () => {
		const body = JSON.stringify({
			subscription: { type: 'stream.offline' },
			event: { broadcaster_user_login: 'user' },
		});
		const req = await signedRequest({ messageType: 'notification', body });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 for unknown subscription type', async () => {
		const body = JSON.stringify({
			subscription: { type: 'channel.follow' },
			event: { user_id: '1', broadcaster_user_id: '2' },
		});
		const req = await signedRequest({ messageType: 'notification', body });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 for revocation and marks subscription revoked', async () => {
		const sql: string[] = [];
		const metaStore = new Map<string, string>();
		const revokeEnv = testEnv({
			TWITCH_EVENTSUB_SECRET: secret,
			DB: mockIngestD1((q) => {
				sql.push(q);
				return {
					bind: (...args: unknown[]) => ({
						run: async () => {
							if (q.includes('INSERT INTO ingest_metadata')) {
								metaStore.set(String(args[0]), String(args[1]));
							}
							return {};
						},
						first: async () => {
							if (q.includes('ingest_metadata')) {
								const key = String(args[0]);
								const value = metaStore.get(key);
								return value ? { value } : null;
							}
							return null;
						},
					}),
				};
			}),
		});

		const body = JSON.stringify({
			subscription: { id: 'sub-revoked-1', status: 'user_removed' },
		});
		const req = await signedRequest({ messageType: 'revocation', body });
		const res = await handleTwitchEventSubWebhook(req, revokeEnv);
		expect(res.status).toBe(204);
		expect(sql.some((q) => q.includes('UPDATE twitch_eventsub_subscriptions'))).toBe(true);
	});

	it('403 for stale timestamp', async () => {
		const stale = new Date(Date.now() - 3600 * 1000);
		const staleTs = stale.toISOString().replace(/\.\d{3}Z$/, '.000000000Z');
		const req = await signedRequest({
			messageType: 'notification',
			body: '{}',
			timestamp: staleTs,
		});
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(403);
	});

	it('400 for invalid JSON body', async () => {
		const req = await signedRequest({ messageType: 'notification', body: 'not-json' });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(400);
	});

	it('204 for unknown message type', async () => {
		const req = await signedRequest({ messageType: 'unknown_type', body: '{}' });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 for notification with missing subscription/event', async () => {
		const warn = vi.spyOn(ingestLog, 'ingestWarn').mockImplementation(() => {});
		const req = await signedRequest({ messageType: 'notification', body: '{}' });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
		expect(warn).toHaveBeenCalledWith('EventSub notification dropped: missing subscription type or event', undefined);
	});

	it('204 and warns for malformed stream.offline notification', async () => {
		const warn = vi.spyOn(ingestLog, 'ingestWarn').mockImplementation(() => {});
		const body = JSON.stringify({
			subscription: { type: 'stream.offline' },
			event: { broadcaster_user_id: '123' },
		});
		const req = await signedRequest({ messageType: 'notification', body });
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
		expect(warn).toHaveBeenCalledWith(
			'EventSub notification dropped: malformed stream.offline',
			expect.objectContaining({ broadcaster_user_id: '123' }),
		);
	});

	it('204 for revocation without subscription id', async () => {
		const req = await signedRequest({
			messageType: 'revocation',
			body: JSON.stringify({ subscription: { status: 'authorization_revoked' } }),
		});
		const res = await handleTwitchEventSubWebhook(req, env);
		expect(res.status).toBe(204);
	});

	it('204 for duplicate notification without re-processing', async () => {
		const body = JSON.stringify({
			subscription: { type: 'stream.online' },
			event: {
				id: 'ev1',
				broadcaster_user_id: '123',
				broadcaster_user_login: 'user',
				broadcaster_user_name: 'User',
				started_at: '2026-06-01T00:00:00Z',
			},
		});
		const first = await signedRequest({ messageType: 'notification', body, messageId: 'dup-1' });
		expect((await handleTwitchEventSubWebhook(first, env)).status).toBe(204);

		const channelRunsBefore = metadata.size;
		const second = await signedRequest({ messageType: 'notification', body, messageId: 'dup-1' });
		const res = await handleTwitchEventSubWebhook(second, env);
		expect(res.status).toBe(204);
		expect(metadata.has('eventsub_msg:dup-1')).toBe(true);
		expect(metadata.size).toBe(channelRunsBefore);
	});
});
