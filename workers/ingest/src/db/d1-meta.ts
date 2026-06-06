/** Log D1 billing meta on hot paths — docs/11, docs/23 (staging/dev tuning). */

export type D1RunResult = {
	meta?: { rows_read?: number; rows_written?: number; changes?: number };
};

export type D1MetaTotals = {
	rows_read: number;
	rows_written: number;
	statements: number;
};

/** Mutable accumulator for one queue message — pass through opts, not module globals. */
export type D1PollCycleAcc = {
	totals: D1MetaTotals;
};

export type D1LogOpts = {
	env?: Env;
	scope?: string;
	pollCycle?: D1PollCycleAcc;
};

/** Optional poll-cycle handle threaded from the queue consumer. */
export type IngestRunOpts = {
	pollCycle?: D1PollCycleAcc;
};

export function emptyD1MetaTotals(): D1MetaTotals {
	return { rows_read: 0, rows_written: 0, statements: 0 };
}

export function createD1PollCycle(): D1PollCycleAcc {
	return { totals: emptyD1MetaTotals() };
}

export function recordD1PollCycle(acc: D1PollCycleAcc | undefined, totals: D1MetaTotals): void {
	if (!acc) return;
	acc.totals = sumD1MetaTotals(acc.totals, totals);
}

export function sumD1MetaTotals(a: D1MetaTotals, b: D1MetaTotals): D1MetaTotals {
	return {
		rows_read: a.rows_read + b.rows_read,
		rows_written: a.rows_written + b.rows_written,
		statements: a.statements + b.statements,
	};
}

export function metaFromD1Result(result: D1RunResult): D1MetaTotals {
	const meta = result.meta ?? {};
	// Local Miniflare sometimes omits rows_written on batch entries; changes is a useful dev fallback.
	const rowsWritten = meta.rows_written ?? meta.changes ?? 0;
	return {
		rows_read: meta.rows_read ?? 0,
		rows_written: rowsWritten,
		statements: 1,
	};
}

export function sumD1Results(results: D1RunResult[] | undefined | null): D1MetaTotals {
	if (!results?.length) return emptyD1MetaTotals();
	return results.reduce((acc, row) => sumD1MetaTotals(acc, metaFromD1Result(row ?? {})), emptyD1MetaTotals());
}

function shouldLogD1Meta(env: Env): boolean {
	if (import.meta.env?.VITEST) return false;
	if (env.D1_META_LOG === '0') return false;
	if (env.D1_META_LOG === '1') return true;
	return env.ENVIRONMENT !== 'production';
}

export function finishD1PollCycle(acc: D1PollCycleAcc | undefined, messageType: string, env: Env): D1MetaTotals | null {
	if (!acc) return null;
	const totals = acc.totals;
	if (!shouldLogD1Meta(env)) return totals;
	console.log('d1:poll_cycle', {
		message: messageType,
		rows_read: totals.rows_read,
		rows_written: totals.rows_written,
		statements: totals.statements,
	});
	return totals;
}

export function logD1Meta(scope: string, result: D1RunResult, opts?: D1LogOpts): void {
	const totals = metaFromD1Result(result);
	recordD1PollCycle(opts?.pollCycle, totals);
	if (!opts?.env || !shouldLogD1Meta(opts.env)) return;
	console.log(`d1:${scope}`, {
		rows_read: totals.rows_read,
		rows_written: totals.rows_written,
		changes: result.meta?.changes ?? 0,
	});
}

export function logD1BatchScope(scope: string, totals: D1MetaTotals, opts?: D1LogOpts): void {
	recordD1PollCycle(opts?.pollCycle, totals);
	if (!opts?.env || !shouldLogD1Meta(opts.env)) return;
	console.log(`d1:${scope}`, {
		rows_read: totals.rows_read,
		rows_written: totals.rows_written,
		statements: totals.statements,
	});
}

/** Merge queue poll-cycle into existing batch log opts. */
export function withIngestRunOpts(batchOpts: D1LogOpts | undefined, runOpts?: IngestRunOpts): D1LogOpts | undefined {
	if (!runOpts?.pollCycle) return batchOpts;
	return { ...batchOpts, pollCycle: runOpts.pollCycle };
}
