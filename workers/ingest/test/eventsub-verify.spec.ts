import { describe, it, expect, beforeEach } from 'vitest';
import {
	buildEventSubHmacMessage,
	clearEventSubKeyCacheForTests,
	verifyTwitchEventSubSignature
} from '../src/twitch/eventsub/verify';

describe('EventSub signature verification', () => {
	const secret = 's3cre77890ab';

	beforeEach(() => {
		clearEventSubKeyCacheForTests();
	});

	it('builds HMAC message in Twitch order (id + timestamp + body)', () => {
		const msg = buildEventSubHmacMessage('abc', '12345', '{"foo":1}');
		expect(msg).toBe('abc12345{"foo":1}');
	});

	it('accepts valid sha256= signature', async () => {
		const messageId = 'test-message-id';
		const timestamp = String(Math.floor(Date.now() / 1000));
		const rawBody = '{"subscription":{"type":"stream.online"},"event":{}}';

		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		const message = buildEventSubHmacMessage(messageId, timestamp, rawBody);
		const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
		const hex = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		const ok = await verifyTwitchEventSubSignature({
			secret,
			messageId,
			timestamp,
			signatureHeader: `sha256=${hex}`,
			rawBody
		});
		expect(ok).toBe(true);
	});

	it('rejects tampered body', async () => {
		const messageId = 'test-message-id';
		const timestamp = String(Math.floor(Date.now() / 1000));
		const rawBody = '{"subscription":{"type":"stream.online"},"event":{}}';

		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		const message = buildEventSubHmacMessage(messageId, timestamp, rawBody);
		const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
		const hex = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		const ok = await verifyTwitchEventSubSignature({
			secret,
			messageId,
			timestamp,
			signatureHeader: `sha256=${hex}`,
			rawBody: rawBody.replace('online', 'offline')
		});
		expect(ok).toBe(false);
	});
});
