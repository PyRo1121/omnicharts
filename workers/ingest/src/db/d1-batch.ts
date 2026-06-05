import { logD1BatchScope } from './d1-meta';

/**
 * D1 limits — https://developers.cloudflare.com/d1/platform/limits/
 * - `batch()`: chunk statements (Free Worker also ~50 subrequests/invoke).
 * - Multi-row INSERT: max 100 bind parameters per query.
 */
export const D1_BATCH_MAX_STATEMENTS = 50;
export const D1_MAX_BIND_PARAMS = 100;

export function chunkArray<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

/** Max rows per multi-column INSERT without exceeding bind cap. */
export function maxRowsPerInsert(columnsPerRow: number): number {
	return Math.max(1, Math.floor(D1_MAX_BIND_PARAMS / columnsPerRow));
}

export async function runD1Batches(
	db: D1Database,
	statements: D1PreparedStatement[],
	opts?: { scope?: string; env?: Env }
): Promise<void> {
	if (statements.length === 0) return;
	for (const chunk of chunkArray(statements, D1_BATCH_MAX_STATEMENTS)) {
		await db.batch(chunk);
		if (opts?.scope && opts?.env) {
			logD1BatchScope(opts.scope, chunk.length, opts.env);
		}
	}
}
