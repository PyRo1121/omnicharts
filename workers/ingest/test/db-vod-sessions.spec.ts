import { describe, it, expect } from 'vitest';
import { mockIngestD1 } from './helpers';
import {
	batchUpsertVodSessions,
	helixVideoToVodSessionRow,
	listChannelsForVodBackfill,
	listChannelsForVodBackfillByPlatformIds,
	markChannelsVodBackfilled,
} from '../src/db/vod-sessions';
import type { HelixVideo } from '../src/twitch/helix';

function mockDb(results: unknown[] = []) {
	const runs: unknown[][] = [];
	const db = mockIngestD1(
		(_sql) => ({
			bind: (...args: unknown[]) => ({
				run: async () => {
					runs.push(args);
					return {};
				},
				all: async () => ({ results }),
			}),
		}),
		async (statements) => {
			await Promise.all(statements.map((stmt) => stmt.run()));
			return [];
		},
	);
	return { db, runs };
}

describe('helixVideoToVodSessionRow', () => {
	it('maps Helix video fields to vod session row', () => {
		const video: HelixVideo = {
			id: '123',
			user_id: '99',
			user_login: 'ninja',
			user_name: 'Ninja',
			title: 'Stream VOD',
			description: '',
			created_at: '2026-06-01T10:00:00.000Z',
			published_at: '2026-06-01T10:00:00.000Z',
			url: 'https://twitch.tv/videos/123',
			thumbnail_url: 'https://thumb',
			viewable: 'public',
			view_count: 500,
			language: 'en',
			type: 'archive',
			duration: 'PT1H',
		};

		const row = helixVideoToVodSessionRow('ch-1', video, {
			started_at: '2026-06-01T10:00:00.000Z',
			ended_at: '2026-06-01T11:00:00.000Z',
		});

		expect(row.view_count).toBe(500);
		expect(row.language).toBe('en');
	});

	it('nulls optional fields when absent', () => {
		const video: HelixVideo = {
			id: '123',
			user_id: '1',
			user_login: 'u',
			user_name: 'U',
			title: 't',
			description: '',
			created_at: '2026-06-01T10:00:00.000Z',
			published_at: '2026-06-01T10:00:00.000Z',
			url: 'https://twitch.tv/videos/123',
			thumbnail_url: '',
			viewable: 'public',
			view_count: Number.NaN,
			language: '',
			type: '',
			duration: '',
		};

		const row = helixVideoToVodSessionRow('ch-1', video, {
			started_at: '2026-06-01T10:00:00.000Z',
			ended_at: null,
		});

		expect(row.language).toBeNull();
		expect(row.thumbnail_url).toBeNull();
		expect(row.stream_type).toBe('archive');
		expect(row.view_count).toBeNull();
	});
});

describe('listChannelsForVodBackfill', () => {
	it('returns tracked channel rows', async () => {
		const rows = [{ id: 'ch-1', platform_channel_id: '111', broadcaster_type: 'partner' }];
		const { db } = mockDb(rows);
		const result = await listChannelsForVodBackfill(db, 5, '2026-01-01T00:00:00.000Z');
		expect(result).toEqual(rows);
	});

	it('returns empty for empty platform id list', async () => {
		const { db } = mockDb();
		await expect(listChannelsForVodBackfillByPlatformIds(db, [])).resolves.toEqual([]);
	});

	it('queries by platform ids', async () => {
		const rows = [{ id: 'ch-2', platform_channel_id: '222', broadcaster_type: null }];
		const { db } = mockDb(rows);
		const result = await listChannelsForVodBackfillByPlatformIds(db, ['222']);
		expect(result).toEqual(rows);
	});
});

describe('batchUpsertVodSessions', () => {
	it('no-ops on empty rows', async () => {
		const { db } = mockDb();
		await expect(batchUpsertVodSessions(db, [])).resolves.toBe(0);
	});

	it('upserts vod session rows', async () => {
		const { db, runs } = mockDb();
		const count = await batchUpsertVodSessions(db, [
			{
				channel_id: 'ch-1',
				platform_stream_id: '999',
				title: 'VOD',
				started_at: '2026-06-01T10:00:00.000Z',
				ended_at: '2026-06-01T11:00:00.000Z',
				language: 'en',
				thumbnail_url: 'https://thumb',
				stream_type: 'archive',
				duration: 'PT1H',
				view_count: 10,
			},
		]);
		expect(count).toBe(1);
		expect(runs[0]?.[0]).toBe('twitch-vod-999');
	});
});

describe('markChannelsVodBackfilled', () => {
	it('no-ops on empty ids', async () => {
		const { db } = mockDb();
		await expect(markChannelsVodBackfilled(db, [])).resolves.toBeUndefined();
	});

	it('updates vod_backfilled_at', async () => {
		const { db, runs } = mockDb();
		await markChannelsVodBackfilled(db, ['ch-1']);
		expect(runs).toHaveLength(1);
		expect(runs[0]?.[1]).toBe('ch-1');
	});
});
