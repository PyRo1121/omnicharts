/** Minimal D1 surface — Cloudflare-agnostic, SQLite-compatible SQL builders. */
export interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
	first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface D1Database {
	prepare(query: string): D1PreparedStatement;
}

export type D1BatchResult = { results?: Record<string, unknown>[] };

export function countFromBatchRow(batchEntry: D1BatchResult): number {
	const row = batchEntry.results?.[0] as { n?: number } | undefined;
	return row?.n ?? 0;
}

export function maxSampleFromBatchRow(batchEntry: D1BatchResult): string | null {
	const row = batchEntry.results?.[0] as { max_sampled_at?: string | null } | undefined;
	return row?.max_sampled_at ?? null;
}
