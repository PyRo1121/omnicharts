import { env } from '$env/dynamic/private';

/** Local design preview only — `?demo=1` or `DEV_MOCK=1`. Never default in prod paths. */
export function isDevMockEnabled(demoParam?: string | null): boolean {
	if (env.DEV_MOCK === '1') return true;
	return demoParam === '1';
}
