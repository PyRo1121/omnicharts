import { describe, it, expect, vi } from 'vitest';
import type { HelixStream } from '../src/twitch/helix';
import {
	applyChannelProfileEnrichment,
	batchApplyChannelProfileEnrichment,
	listPlatformIdsForProfileEnrichment,
	recordLiveSample,
	upsertChannelFromStream,
	upsertGameCategory,
} from '../src/db/twitch';
import * as twitchBatch from '../src/db/twitch-live-batch';

const stream: HelixStream = {
	id: 's1',
	user_id: '42',
	user_login: 'u',
	user_name: 'U',
	game_id: '10',
	game_name: 'Game',
	title: 'T',
	viewer_count: 50,
	started_at: '2026-06-01T00:00:00Z',
	type: 'live',
};

describe('db twitch helpers', () => {
	it('upsertGameCategory falls back when batch map empty', async () => {
		vi.spyOn(twitchBatch, 'batchUpsertGameCategories').mockResolvedValue(new Map());
		const id = await upsertGameCategory({} as D1Database, { id: '10', name: 'Game' });
		expect(id).toBe('twitch-game-10');
	});

	it('upsertGameCategory returns mapped id when batch succeeds', async () => {
		vi.spyOn(twitchBatch, 'batchUpsertGameCategories').mockResolvedValue(new Map([['10', 'twitch-game-10']]));
		const id = await upsertGameCategory({} as D1Database, { id: '10', name: 'Game' });
		expect(id).toBe('twitch-game-10');
	});

	it('upsertChannelFromStream falls back when batch map empty', async () => {
		vi.spyOn(twitchBatch, 'batchUpsertChannelsFromStreams').mockResolvedValue(new Map());
		const id = await upsertChannelFromStream({} as D1Database, stream, {
			minViewers: 5,
			promoteToTracked: true,
		});
		expect(id).toBe('twitch-ch-42');
	});

	it('listPlatformIdsForProfileEnrichment queries stale profile rows', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (...args: unknown[]) => ({
				all: async () => {
					expect(sql).toContain('profile_enriched_at');
					expect(args[0]).toBe('twitch');
					return { results: [{ platform_channel_id: '1' }] };
				},
			}),
		}));
		const ids = await listPlatformIdsForProfileEnrichment({ prepare } as unknown as D1Database, 10, 24);
		expect(ids).toEqual(['1']);
	});

	it('applyChannelProfileEnrichment updates channel profile fields', async () => {
		const binds: unknown[][] = [];
		const db = {
			prepare: (sql: string) => ({
				bind: (...args: unknown[]) => ({
					run: async () => {
						binds.push([sql, ...args]);
					},
				}),
			}),
		} as unknown as D1Database;

		await applyChannelProfileEnrichment(db, {
			platform_channel_id: '42',
			display_name: 'Name',
			avatar_url: null,
			description: null,
			broadcaster_type: 'partner',
			platform_created_at: null,
			channel_profile_json: '{}',
			follower_count: 1000,
		});

		expect(binds[0]?.[0]).toContain('UPDATE channels SET');
		expect(binds[0]).toContain(1000);
	});

	it('batchApplyChannelProfileEnrichment no-ops for empty rows', async () => {
		const batch = vi.fn();
		await batchApplyChannelProfileEnrichment({ batch } as unknown as D1Database, []);
		expect(batch).not.toHaveBeenCalled();
	});

	it('batchApplyChannelProfileEnrichment runs profile updates without follower_count', async () => {
		const run = vi.fn();
		const db = {
			prepare: () => ({
				bind: () => ({ run }),
			}),
			batch: vi.fn(async (stmts: { run: () => Promise<unknown> }[]) => {
				for (const s of stmts) await s.run();
				return [];
			}),
		} as unknown as D1Database;

		await batchApplyChannelProfileEnrichment(db, [
			{
				platform_channel_id: '42',
				display_name: 'Name',
				avatar_url: null,
				description: null,
				broadcaster_type: null,
				platform_created_at: null,
				channel_profile_json: null,
				follower_count: null,
			},
		]);

		expect(run).toHaveBeenCalled();
	});

	it('recordLiveSample delegates to batchRecordLiveSamples', async () => {
		vi.spyOn(twitchBatch, 'batchRecordLiveSamples').mockResolvedValue([
			{
				stream_session_id: 'sess',
				sampled_at: '2026-06-01T00:00:00Z',
				viewer_count: 50,
				platform: 'twitch',
			},
		]);
		const row = await recordLiveSample({} as D1Database, 'ch-1', stream, 'game-1');
		expect(row.platform).toBe('twitch');
	});
});
