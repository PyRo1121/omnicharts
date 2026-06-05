import { describe, it, expect, vi } from 'vitest';
import { recordKickApiChannelId, resolveKickApiChannelId } from '../src/kick/api-channel-id';

describe('kick api-channel-id metadata', () => {
	it('recordKickApiChannelId no-ops for non-finite channelId', async () => {
		const run = vi.fn();
		const db = { prepare: () => ({ bind: () => ({ run }) }) } as unknown as D1Database;
		await recordKickApiChannelId(db, '42', Number.NaN);
		expect(run).not.toHaveBeenCalled();
	});

	it('resolveKickApiChannelId returns null for missing or invalid metadata', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					first: async () => null,
				}),
			}),
		} as unknown as D1Database;
		await expect(resolveKickApiChannelId(db, '42')).resolves.toBeNull();

		const badDb = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({ value: 'not-a-number' }),
				}),
			}),
		} as unknown as D1Database;
		await expect(resolveKickApiChannelId(badDb, '42')).resolves.toBeNull();
	});

	it('resolveKickApiChannelId parses stored channel id', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({ value: '420' }),
				}),
			}),
		} as unknown as D1Database;
		await expect(resolveKickApiChannelId(db, '42')).resolves.toBe(420);
	});
});
