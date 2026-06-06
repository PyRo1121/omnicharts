export type StmtHandlers = {
	bind?: (...values: unknown[]) => StmtHandlers;
	first?: <T = Record<string, unknown>>(colName?: string) => Promise<T | null>;
	all?: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
	run?: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
	raw?: <T = unknown[]>(options?: { columnNames?: boolean }) => Promise<T[] | [string[], ...T[]]>;
};

function createPreparedStatement(handlers: StmtHandlers): D1PreparedStatement {
	const stmt: D1PreparedStatement = {
		bind(...values: unknown[]) {
			if (handlers.bind) {
				handlers = handlers.bind(...values);
			}
			return stmt;
		},
		first<T = Record<string, unknown>>(colName?: string) {
			if (handlers.first) {
				return handlers.first<T>(colName);
			}
			throw new Error('unexpected first()');
		},
		run<T = Record<string, unknown>>() {
			if (handlers.run) {
				return handlers.run<T>();
			}
			throw new Error('unexpected run()');
		},
		all<T = Record<string, unknown>>() {
			if (handlers.all) {
				return handlers.all<T>();
			}
			throw new Error('unexpected all()');
		},
		raw<T = unknown[]>(options?: { columnNames?: boolean }) {
			if (handlers.raw) {
				return handlers.raw<T>(options);
			}
			throw new Error('unexpected raw()');
		},
	};
	return stmt;
}

function createSession(
	prepareFn: (query: string) => StmtHandlers,
	batchFn?: (statements: D1PreparedStatement[]) => Promise<D1Result[]>,
): D1DatabaseSession {
	return {
		prepare(query: string) {
			return createPreparedStatement(prepareFn(query));
		},
		batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
			if (!batchFn) {
				throw new Error('unexpected batch()');
			}
			return batchFn(statements);
		},
		getBookmark() {
			return null;
		},
	};
}

/** Minimal D1 double with custom prepare (and optional batch) handlers per SQL string. */
export function mockIngestD1(
	prepare: (sql: string) => StmtHandlers,
	batch?: (statements: D1PreparedStatement[]) => Promise<D1Result[]>,
): D1Database {
	const db: D1Database = {
		prepare(query: string) {
			return createPreparedStatement(prepare(query));
		},
		batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
			if (!batch) {
				throw new Error('unexpected batch()');
			}
			return batch(statements);
		},
		exec(_query: string) {
			throw new Error('unexpected exec()');
		},
		withSession(_constraintOrBookmark?: D1SessionBookmark) {
			return createSession(prepare, batch);
		},
		dump() {
			throw new Error('unexpected dump()');
		},
	};
	return db;
}

/** D1 stub for tests where SQL is never executed (e.g. spied collaborators). */
export function unusedIngestD1(): D1Database {
	return mockIngestD1(() => {
		throw new Error('unexpected prepare');
	});
}
