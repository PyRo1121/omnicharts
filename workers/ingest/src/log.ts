/** Console helpers — no-op under Vitest so unit/integration runs stay quiet. */

function isVitest(): boolean {
	return typeof import.meta !== 'undefined' && import.meta.env?.VITEST === true;
}

export function ingestWarn(...args: unknown[]): void {
	if (isVitest()) return;
	console.warn(...args);
}

export function ingestNonFatalError(scope: string, err: unknown): void {
	if (isVitest()) return;
	console.error(scope, err);
}
