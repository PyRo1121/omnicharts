export type StmtHandlers = {
	bind?: (...values: unknown[]) => StmtHandlers;
	first?: <T = Record<string, unknown>>(colName?: string) => Promise<T | null>;
	all?: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
	run?: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
	raw?: <T = unknown[]>(options?: { columnNames?: boolean }) => Promise<T[] | [string[], ...T[]]>;
};

class TestPreparedStatement extends D1PreparedStatement {
	private handlers: StmtHandlers;

	constructor(handlers: StmtHandlers) {
		super();
		this.handlers = handlers;
	}

	bind(...values: unknown[]): D1PreparedStatement {
		if (this.handlers.bind) {
			this.handlers = this.handlers.bind(...values);
		}
		return this;
	}

	first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
		if (this.handlers.first) {
			return this.handlers.first<T>(colName);
		}
		throw new Error('unexpected first()');
	}

	run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		if (this.handlers.run) {
			return this.handlers.run<T>();
		}
		throw new Error('unexpected run()');
	}

	all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		if (this.handlers.all) {
			return this.handlers.all<T>();
		}
		throw new Error('unexpected all()');
	}

	raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
	raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
	raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
		if (this.handlers.raw) {
			return this.handlers.raw<T>(options);
		}
		throw new Error('unexpected raw()');
	}
}

class TestD1DatabaseSession extends D1DatabaseSession {
	constructor(
		private readonly prepareFn: (query: string) => StmtHandlers,
		private readonly batchFn?: (statements: D1PreparedStatement[]) => Promise<D1Result[]>,
	) {
		super();
	}

	prepare(query: string): D1PreparedStatement {
		return new TestPreparedStatement(this.prepareFn(query));
	}

	batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
		if (!this.batchFn) {
			throw new Error('unexpected batch()');
		}
		return this.batchFn(statements);
	}

	getBookmark(): D1SessionBookmark | null {
		throw new Error('unexpected getBookmark()');
	}
}

class TestD1Database extends D1Database {
	constructor(
		private readonly prepareFn: (query: string) => StmtHandlers,
		private readonly batchFn?: (statements: D1PreparedStatement[]) => Promise<D1Result[]>,
	) {
		super();
	}

	prepare(query: string): D1PreparedStatement {
		return new TestPreparedStatement(this.prepareFn(query));
	}

	batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
		if (!this.batchFn) {
			throw new Error('unexpected batch()');
		}
		return this.batchFn(statements);
	}

	exec(_query: string): Promise<D1ExecResult> {
		throw new Error('unexpected exec()');
	}

	withSession(_constraintOrBookmark?: D1SessionBookmark): D1DatabaseSession {
		return new TestD1DatabaseSession(this.prepareFn, this.batchFn);
	}

	dump(): Promise<ArrayBuffer> {
		throw new Error('unexpected dump()');
	}
}

/** Minimal D1 double with custom prepare (and optional batch) handlers per SQL string. */
export function mockIngestD1(
	prepare: (sql: string) => StmtHandlers,
	batch?: (statements: D1PreparedStatement[]) => Promise<D1Result[]>,
): D1Database {
	return new TestD1Database(prepare, batch);
}

/** D1 stub for tests where SQL is never executed (e.g. spied collaborators). */
export function unusedIngestD1(): D1Database {
	return mockIngestD1(() => {
		throw new Error('unexpected prepare');
	});
}
