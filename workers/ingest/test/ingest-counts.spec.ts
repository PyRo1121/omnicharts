import { describe, it, expect } from 'vitest';
import { fetchIngestStateCounts } from '../src/health/ingest-counts';

describe('fetchIngestStateCounts', () => {
	it('aggregates ingest_state rows', async () => {
		const db = {
			prepare() {
				return {
					bind() {
						return {
							all: async () => ({
								results: [
									{ ingest_state: 'tracked', n: 10 },
									{ ingest_state: 'discovered', n: 3 },
								],
							}),
						};
					},
				};
			},
		};

		const counts = await fetchIngestStateCounts(db);
		expect(counts.twitch.tracked).toBe(10);
		expect(counts.twitch.discovered).toBe(3);
		expect(counts.twitch.dormant).toBe(0);
	});
});
