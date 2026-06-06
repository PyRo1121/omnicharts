import type { D1Database, D1PreparedStatement } from '@omnicharts/rollup';

export { mockD1Database, unusedMockD1 } from '../../../../../packages/rollup/test/mock-d1';
import { mockD1Database } from '../../../../../packages/rollup/test/mock-d1';

type StmtHandlers = {
	bind?: (...values: unknown[]) => StmtHandlers;
	first?: () => Promise<unknown>;
	all?: () => Promise<{ results?: unknown[] }>;
};

/** Rollup-shaped D1 statement double for API route tests. */
export function stubD1Statement(handlers: StmtHandlers): D1PreparedStatement {
	const stmt: D1PreparedStatement = {
		bind(...values: unknown[]) {
			if (handlers.bind) handlers = handlers.bind(...values);
			return stmt;
		},
		async first<T = Record<string, unknown>>() {
			return handlers.first ? (handlers.first() as Promise<T | null>) : null;
		},
		async all<T = Record<string, unknown>>() {
			return handlers.all ? (handlers.all() as Promise<{ results?: T[] }>) : { results: [] };
		},
	};
	return stmt;
}

/** Map SQL strings to statement handlers — satisfies rollup {@link D1PreparedStatement}. */
export function mockD1FromSql(handler: (sql: string) => StmtHandlers): D1Database {
	return mockD1Database((sql) => stubD1Statement(handler(sql)));
}
