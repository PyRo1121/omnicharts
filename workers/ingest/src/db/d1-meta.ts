/** Log D1 billing meta on hot paths — docs/11-cloudflare-deployment.md */

export type D1RunResult = {
	meta?: { rows_read?: number; rows_written?: number; changes?: number };
};

function shouldLogD1Meta(env: Env): boolean {
	if (import.meta.env?.VITEST) return false;
	if (env.D1_META_LOG === '0') return false;
	if (env.D1_META_LOG === '1') return true;
	return env.ENVIRONMENT !== 'production';
}

export function logD1Meta(scope: string, result: D1RunResult, env: Env): void {
	if (!shouldLogD1Meta(env)) return;
	const meta = result.meta ?? {};
	console.log(`d1:${scope}`, {
		rows_read: meta.rows_read ?? 0,
		rows_written: meta.rows_written ?? 0,
		changes: meta.changes ?? 0,
	});
}

export function logD1BatchScope(scope: string, statementCount: number, env: Env): void {
	if (!shouldLogD1Meta(env)) return;
	console.log(`d1:${scope}`, { statements: statementCount });
}
