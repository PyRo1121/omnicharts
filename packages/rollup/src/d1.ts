/** Minimal D1 surface — Cloudflare-agnostic, SQLite-compatible SQL builders. */
export interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- D1 row shape at call site
	all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
	// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- D1 row shape at call site
	first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface D1Database {
	prepare(query: string): D1PreparedStatement;
}

export type D1BatchResult = { results?: Record<string, unknown>[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Normalize Cloudflare D1 batch entries without unsafe assertions. */
export function normalizeBatchResult(entry: { results?: unknown[] }): D1BatchResult {
	const raw = entry.results;
	if (!raw) return {};
	return {
		results: raw.map((row) => (isRecord(row) ? row : {})),
	};
}

export function countFromBatchRow(batchEntry: D1BatchResult): number {
	const row = batchEntry.results?.[0];
	if (!row) return 0;
	const n = row.n;
	return typeof n === 'number' ? n : 0;
}

export function maxSampleFromBatchRow(batchEntry: D1BatchResult): string | null {
	const row = batchEntry.results?.[0];
	if (!row) return null;
	const max = row.max_sampled_at;
	if (typeof max === 'string') return max;
	return max === null ? null : null;
}
