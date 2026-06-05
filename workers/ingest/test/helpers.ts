import { mockIngestD1, unusedIngestD1 } from './mock-d1';

export { mockIngestD1, unusedIngestD1 };
export type { StmtHandlers } from './mock-d1';

const TEST_ENV_DEFAULTS = {
	TWITCH_CLIENT_ID: 'test-client-id',
	TWITCH_CLIENT_SECRET: 'test-client-secret',
	TWITCH_EVENTSUB_SECRET: 'test-eventsub-secret',
	TWITCH_EVENTSUB_CALLBACK_URL: 'https://example.com/eventsub',
	INGEST_COVERAGE_MODE: 'full',
	LIVE_SWEEP_MAX_PAGES: '10',
	TWITCH_MIN_VIEWERS: '0',
	TWITCH_MAX_TRACKED: '1000',
	EVENTSUB_SYNC_MAX_CHANNELS_PER_RUN: '100',
	ADMIN_API_KEY: 'test-admin-key',
	TWITCH_RANKING_MIN_AIRTIME_MINUTES: '60',
	SAMPLE_ARCHIVE_MIN_ROWS: '10',
	DB: unusedIngestD1(),
} satisfies Env;

/** Full Env defaults for ingest tests; spread overrides as needed. */
export function testEnv(overrides?: Partial<Env>): Env {
	if (!overrides) {
		return { ...TEST_ENV_DEFAULTS };
	}
	return { ...TEST_ENV_DEFAULTS, ...overrides };
}

/** D1 mock for poll batch tests that track SQL via run(). */
export function pollBatchD1(onRun: (sql: string) => void): D1Database {
	return mockIngestD1(
		(sql) => ({
			bind: () => ({
				run: async () => {
					onRun(sql);
					return {};
				},
			}),
		}),
		async (statements) => {
			for (const stmt of statements) await stmt.run();
			return [];
		},
	);
}

/** D1 stub with empty prepare/batch for poll tests that mock DB collaborators. */
export function noopBatchD1(): D1Database {
	return mockIngestD1(
		() => ({ bind: () => ({ run: async () => ({}) }) }),
		async () => [],
	);
}

export function healthStatusD1(): D1Database {
	return mockIngestD1(
		() => ({
			first: async () => ({}),
			bind: () => ({
				first: async () => ({}),
			}),
		}),
		async (stmts) => {
			if (stmts.length === 4) {
				return [
					{ results: [{ ok: 1 }] },
					{ results: [{ value: '2026-05-31T00:15:00.000Z' }] },
					{ results: [{ ingest_state: 'tracked', n: 42 }] },
					{ results: [{ value: '{"at":"2026-06-01T00:00:00.000Z"}' }] },
				];
			}
			if (stmts.length === 2) {
				return [{ results: [{ n: 5 }] }, { results: [{ n: 2 }] }];
			}
			return [
				{ results: [{ n: 3 }] },
				{ results: [{ n: 1 }] },
				{ results: [{ n: 1 }] },
				{ results: [{ n: 2 }] },
				{ results: [{ max_sampled_at: new Date().toISOString() }] },
			];
		},
	);
}
