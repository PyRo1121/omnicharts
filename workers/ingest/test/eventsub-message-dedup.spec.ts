import { describe, it, expect } from 'vitest';
import {
	EVENTSUB_MESSAGE_DEDUP_TTL_MS,
	isDuplicateEventSubMessage,
	recordEventSubMessageId
} from '../src/twitch/eventsub/message-dedup';

describe('EventSub message dedup', () => {
	it('returns false when key missing', async () => {
		const db = {
			prepare() {
				return { bind: () => ({ first: async () => null }) };
			}
		} as unknown as D1Database;
		expect(await isDuplicateEventSubMessage(db, 'msg-1')).toBe(false);
	});

	it('returns true for fresh duplicate', async () => {
		const db = {
			prepare(sql: string) {
				return {
					bind: () => ({
						first: async () =>
							sql.includes('SELECT')
								? {
										value: JSON.stringify({ seenAt: new Date().toISOString() })
									}
								: null,
						run: async () => ({})
					})
				};
			}
		} as unknown as D1Database;
		expect(await isDuplicateEventSubMessage(db, 'msg-1')).toBe(true);
	});

	it('returns false when entry expired', async () => {
		const stale = new Date(Date.now() - EVENTSUB_MESSAGE_DEDUP_TTL_MS - 1000).toISOString();
		const db = {
			prepare(sql: string) {
				return {
					bind: () => ({
						first: async () =>
							sql.includes('SELECT')
								? { value: JSON.stringify({ seenAt: stale }) }
								: null,
						run: async () => ({})
					})
				};
			}
		} as unknown as D1Database;
		expect(await isDuplicateEventSubMessage(db, 'msg-old')).toBe(false);
	});

	it('recordEventSubMessageId writes ingest_metadata', async () => {
		const sql: string[] = [];
		const db = {
			prepare(q: string) {
				sql.push(q);
				return { bind: () => ({ run: async () => ({}) }) };
			}
		} as unknown as D1Database;
		await recordEventSubMessageId(db, 'msg-new');
		expect(sql.some((s) => s.includes('ingest_metadata'))).toBe(true);
	});
});
