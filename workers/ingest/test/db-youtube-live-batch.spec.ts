import { describe, it, expect, vi } from 'vitest';
import type { YoutubeVideoItem } from '../src/youtube/types';
import {
	batchRecordYoutubeLiveSamples,
	clearYoutubeLiveVideoIds
} from '../src/db/youtube-live-batch';

function mockDb() {
	const runs: string[] = [];
	const batch = vi.fn(async (statements: { run: () => Promise<unknown> }[]) => {
		for (const stmt of statements) await stmt.run();
		return [];
	});
	const prepare = vi.fn((sql: string) => ({
		bind: (..._args: unknown[]) => ({
			run: async () => {
				runs.push(sql);
				return { meta: { changes: 1 } };
			},
			all: async () => ({ results: [] as unknown[] })
		})
	}));
	return {
		db: { prepare, batch } as unknown as D1Database,
		runs,
		prepare,
		batch
	};
}

const liveVideo = (over: Partial<YoutubeVideoItem> = {}): YoutubeVideoItem => ({
	id: 'vid-live',
	snippet: {
		channelId: 'UCabc',
		title: 'Live stream',
		liveBroadcastContent: 'live'
	},
	liveStreamingDetails: {
		actualStartTime: '2026-06-01T00:00:00Z',
		concurrentViewers: '120'
	},
	...over
});

describe('batchRecordYoutubeLiveSamples', () => {
	it('writes viewer_samples for live video with concurrentViewers', async () => {
		const { db, runs } = mockDb();
		const archive = await batchRecordYoutubeLiveSamples(db, [
			{ channelId: 'youtube-ch-1', video: liveVideo() }
		]);
		expect(archive).toHaveLength(1);
		expect(archive[0]?.viewer_count).toBe(120);
		expect(runs.some((s) => s.includes('INSERT INTO viewer_samples'))).toBe(true);
		expect(runs.some((s) => s.includes('INSERT INTO stream_sessions'))).toBe(true);
	});

	it('skips hidden concurrentViewers', async () => {
		const { db, runs } = mockDb();
		const archive = await batchRecordYoutubeLiveSamples(db, [
			{
				channelId: 'youtube-ch-1',
				video: liveVideo({ liveStreamingDetails: { actualStartTime: '2026-06-01T00:00:00Z' } })
			}
		]);
		expect(archive).toEqual([]);
		expect(runs.some((s) => s.includes('INSERT INTO viewer_samples'))).toBe(false);
	});

	it('closes stale session when platform_stream_id changes', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('ended_at IS NULL')) {
						return {
							results: [
								{
									id: 'sess-old',
									channel_id: 'youtube-ch-1',
									platform_stream_id: 'vid-old',
									started_at: '2026-05-31T00:00:00Z'
								}
							]
						};
					}
					return { results: [] };
				}
			})
		}));
		const batch = vi.fn(async () => []);
		const db = { prepare, batch } as unknown as D1Database;

		await batchRecordYoutubeLiveSamples(db, [{ channelId: 'youtube-ch-1', video: liveVideo() }]);
		expect(batch).toHaveBeenCalled();
	});
});

describe('clearYoutubeLiveVideoIds', () => {
	it('UPDATEs youtube_live_video_id to NULL for tracked rows', async () => {
		const { db, batch } = mockDb();
		await clearYoutubeLiveVideoIds(db, ['ch-1', 'ch-2']);
		expect(batch).toHaveBeenCalled();
	});

	it('no-ops for empty channel list', async () => {
		const { db, batch } = mockDb();
		await clearYoutubeLiveVideoIds(db, []);
		expect(batch).not.toHaveBeenCalled();
	});

	it('updates title on existing open session', async () => {
		const prepare = vi.fn((sql: string) => ({
			bind: (..._args: unknown[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => {
					if (sql.includes('ended_at IS NULL')) {
						return {
							results: [
								{
									id: 'sess-1',
									channel_id: 'youtube-ch-1',
									platform_stream_id: 'vid-live',
									started_at: '2026-06-01T00:00:00Z'
								}
							]
						};
					}
					return { results: [] };
				}
			})
		}));
		const batch = vi.fn(async () => []);
		const db = { prepare, batch } as unknown as D1Database;

		await batchRecordYoutubeLiveSamples(db, [{ channelId: 'youtube-ch-1', video: liveVideo() }]);
		expect(prepare.mock.calls.some(([sql]) => String(sql).includes('UPDATE stream_sessions'))).toBe(
			true
		);
	});
});
