import { describe, it, expect } from 'vitest';
import { EVENTSUB_SYNC_CURSOR_KEY, getEventSubSyncCursor, setEventSubSyncCursor } from '../src/twitch/eventsub/sync-cursor';

describe('EventSub sync cursor', () => {
	it('getEventSubSyncCursor returns 0 when missing or invalid', async () => {
		const db = {
			prepare() {
				return {
					bind: () => ({
						first: async () => null,
					}),
				};
			},
		} as unknown as D1Database;
		expect(await getEventSubSyncCursor(db)).toBe(0);

		const bad = {
			prepare() {
				return {
					bind: () => ({
						first: async () => ({ value: 'nope' }),
					}),
				};
			},
		} as unknown as D1Database;
		expect(await getEventSubSyncCursor(bad)).toBe(0);
	});

	it('setEventSubSyncCursor persists offset', async () => {
		const sql: string[] = [];
		const db = {
			prepare(q: string) {
				sql.push(q);
				return {
					bind: (...args: unknown[]) => ({
						first: async () =>
							q.includes('SELECT value FROM ingest_metadata') ? { value: String(args[0] === EVENTSUB_SYNC_CURSOR_KEY ? '7' : '') } : null,
						run: async () => ({}),
					}),
				};
			},
		} as unknown as D1Database;

		await setEventSubSyncCursor(db, 12);
		expect(sql.some((s) => s.includes('ingest_metadata'))).toBe(true);
		expect(await getEventSubSyncCursor(db)).toBe(7);
	});
});
