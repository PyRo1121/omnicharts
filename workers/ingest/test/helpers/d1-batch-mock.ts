/** Minimal D1 mock helpers for batch ingest (`IN` queries + `batch()`). */

export function d1BindRunner(
	sql: string,
	onRun?: (sql: string) => void
): { run: () => Promise<Record<string, never>> } {
	return {
		run: async () => {
			onRun?.(sql);
			return {};
		}
	};
}

export function d1BatchFromDb(db: {
	prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown> } };
}): (statements: { run: () => Promise<unknown> }[]) => Promise<unknown[]> {
	return async (statements) => {
		const results = [];
		for (const stmt of statements) {
			results.push(await stmt.run());
		}
		return results;
	};
}
