import { PLATFORM_TWITCH } from '@omnicharts/domain';

export type IngestStateCounts = {
	discovered: number;
	tracked: number;
	dormant: number;
	retired: number;
};

export type PlatformIngestCounts = {
	twitch: IngestStateCounts;
};

export async function fetchIngestStateCounts(db: D1Database): Promise<PlatformIngestCounts> {
	const empty: IngestStateCounts = {
		discovered: 0,
		tracked: 0,
		dormant: 0,
		retired: 0,
	};

	const { results } = await db
		.prepare(
			`SELECT ingest_state, COUNT(*) AS n FROM channels
       WHERE platform_id = ?
       GROUP BY ingest_state`,
		)
		.bind(PLATFORM_TWITCH)
		.all<{ ingest_state: string; n: number }>();

	const twitch = { ...empty };
	for (const row of results ?? []) {
		if (row.ingest_state in twitch) {
			twitch[row.ingest_state as keyof IngestStateCounts] = row.n;
		}
	}

	return { twitch };
}
