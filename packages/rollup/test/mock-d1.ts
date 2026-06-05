import type { D1Database, D1PreparedStatement } from '../src/d1';

/** D1 stub for tests where SQL is never executed (e.g. spied collaborators). */
export function unusedMockD1(): D1Database {
	return {
		prepare(_query: string): D1PreparedStatement {
			throw new Error('Unexpected D1 prepare in test');
		},
	};
}

/** Minimal {@link D1Database} double with a custom prepare implementation. */
export function mockD1Database(prepare: D1Database['prepare']): D1Database {
	return { prepare };
}
