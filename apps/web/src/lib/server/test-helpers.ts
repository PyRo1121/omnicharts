import { vi } from 'vitest';
import type { ServerLoadContext } from './load-context';

/** Vitest loads without Cloudflare platform — force ingest HTTP fallback. */
export function testLoadContext(fetchFn: typeof fetch): ServerLoadContext {
	return { fetch: fetchFn, db: null, cfEnv: null };
}

export function testLoadContextWithDb(fetchFn: typeof fetch, db: D1Database): ServerLoadContext {
	return { fetch: fetchFn, db, cfEnv: null };
}

type MockD1BatchEntry = { results?: unknown[] };

/** Minimal D1 mock for homepage batch tests. */
export function mockD1Batch(batchResults: MockD1BatchEntry[]): D1Database {
	const normalized = batchResults.map(
		(entry) =>
			({
				success: true,
				results: entry.results ?? [],
				meta: {
					duration: 0,
					size_after: 0,
					rows_read: 0,
					rows_written: 0
				}
			}) as D1Result
	);
	return {
		batch: vi.fn().mockResolvedValue(normalized),
		prepare: vi.fn().mockReturnValue({
			bind: vi.fn().mockReturnThis(),
			all: vi.fn()
		})
	} as unknown as D1Database;
}
