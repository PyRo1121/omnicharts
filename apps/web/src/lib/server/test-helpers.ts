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

const D1_META: D1Meta = {
	duration: 0,
	size_after: 0,
	rows_read: 0,
	rows_written: 0,
};

function stubPreparedStatement(): D1PreparedStatement {
	const stmt: D1PreparedStatement = {
		bind() {
			return stmt;
		},
		first: async () => null,
		run: async () => ({ success: true, results: [], meta: D1_META }),
		all: async () => ({ success: true, results: [], meta: D1_META }),
		raw: async () => [],
	};
	return stmt;
}

function stubD1Session(): D1DatabaseSession {
	return {
		prepare: () => stubPreparedStatement(),
		batch: async () => [],
		getBookmark: () => null,
	};
}

/** Minimal D1 mock for homepage batch tests. */
export function mockD1Batch(batchResults: MockD1BatchEntry[]): D1Database {
	const normalized = batchResults.map(
		(entry) =>
			({
				success: true,
				results: entry.results ?? [],
				meta: D1_META,
			}) satisfies D1Result,
	);
	const db: D1Database = {
		batch: vi.fn().mockResolvedValue(normalized),
		prepare: vi.fn().mockReturnValue({
			bind: vi.fn().mockReturnThis(),
			all: vi.fn(),
			first: vi.fn(),
			run: vi.fn(),
			raw: vi.fn(),
		}),
		exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
		withSession: vi.fn().mockReturnValue(stubD1Session()),
		dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
	};
	return db;
}
