import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	claimKickWebhookMessageId,
	isDuplicateKickWebhookMessage,
	recordKickWebhookMessageId,
	releaseKickWebhookMessageId,
} from '../src/kick/webhook/message-dedup';

function mockDb(store = new Map<string, string>()) {
	return {
		prepare(sql: string) {
			return {
				bind: (...args: unknown[]) => ({
					async first() {
						if (sql.includes('SELECT value FROM ingest_metadata')) {
							const key = String(args[0]);
							const value = store.get(key);
							return value ? { value } : null;
						}
						return null;
					},
					async run() {
						if (sql.includes('DELETE FROM ingest_metadata')) {
							store.delete(String(args[0]));
							return { meta: { changes: 1 } };
						}
						if (sql.includes('INSERT INTO ingest_metadata')) {
							const key = String(args[0]);
							if (sql.includes('ON CONFLICT(key) DO NOTHING') && store.has(key)) {
								return { meta: { changes: 0 } };
							}
							store.set(key, String(args[1]));
							return { meta: { changes: 1 } };
						}
						if (sql.includes('ON CONFLICT(key) DO UPDATE')) {
							store.set(String(args[0]), String(args[1]));
							return { meta: { changes: 1 } };
						}
						return { meta: { changes: 0 } };
					},
				}),
			};
		},
	} as unknown as D1Database;
}

describe('kick webhook message dedup', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
	});

	it('claimKickWebhookMessageId rejects duplicate within TTL', async () => {
		const db = mockDb();
		expect(await claimKickWebhookMessageId(db, 'msg-1')).toBe(true);
		expect(await claimKickWebhookMessageId(db, 'msg-1')).toBe(false);
	});

	it('isDuplicateKickWebhookMessage returns false after TTL expires', async () => {
		const db = mockDb();
		await recordKickWebhookMessageId(db, 'msg-2');
		expect(await isDuplicateKickWebhookMessage(db, 'msg-2')).toBe(true);
		vi.advanceTimersByTime(11 * 60 * 1000);
		expect(await isDuplicateKickWebhookMessage(db, 'msg-2')).toBe(false);
	});

	it('isDuplicateKickWebhookMessage treats invalid JSON as not duplicate', async () => {
		const store = new Map([['kick_webhook_msg:bad', '{not-json}']]);
		const db = mockDb(store);
		expect(await isDuplicateKickWebhookMessage(db, 'bad')).toBe(false);
	});

	it('releaseKickWebhookMessageId clears claim for retry', async () => {
		const store = new Map<string, string>();
		const db = mockDb(store);
		await recordKickWebhookMessageId(db, 'msg-3');
		await releaseKickWebhookMessageId(db, 'msg-3');
		expect(await claimKickWebhookMessageId(db, 'msg-3')).toBe(true);
	});
});
