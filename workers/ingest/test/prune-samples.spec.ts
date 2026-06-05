import { describe, it, expect } from 'vitest';
import {
	pruneViewerSamplesOlderThanRetention,
	VIEWER_SAMPLE_DELETE_BATCH_SIZE,
	viewerSampleRetentionCutoffIso
} from '../src/db/prune-samples';

describe('pruneViewerSamplesOlderThanRetention', () => {
	it('deletes in batches until fewer than batch size remain', async () => {
		const cutoff = viewerSampleRetentionCutoffIso(new Date('2026-06-03T12:00:00.000Z'));
		let deleteCalls = 0;
		const db = {
			prepare(sql: string) {
				return {
					bind(boundCutoff: string, limit: number) {
						expect(sql).toContain('DELETE FROM viewer_samples');
						expect(boundCutoff).toBe(cutoff);
						expect(limit).toBe(VIEWER_SAMPLE_DELETE_BATCH_SIZE);
						return {
							run: async () => {
								deleteCalls += 1;
								const changes =
									deleteCalls === 1 ? VIEWER_SAMPLE_DELETE_BATCH_SIZE : 12;
								return { meta: { changes } };
							}
						};
					}
				};
			}
		} as unknown as D1Database;

		const pruned = await pruneViewerSamplesOlderThanRetention(
			db,
			new Date('2026-06-03T12:00:00.000Z')
		);
		expect(pruned).toBe(VIEWER_SAMPLE_DELETE_BATCH_SIZE + 12);
		expect(deleteCalls).toBe(2);
	});

	it('stops when first batch deletes zero rows', async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					run: async () => ({ meta: { changes: 0 } })
				})
			})
		} as unknown as D1Database;

		await expect(pruneViewerSamplesOlderThanRetention(db)).resolves.toBe(0);
	});
});
