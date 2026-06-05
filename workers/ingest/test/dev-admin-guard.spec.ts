import { describe, it, expect } from 'vitest';
import { isDevAdminRouteAllowed } from '../src/dev/admin-guard';

describe('isDevAdminRouteAllowed', () => {
	it('blocks production without ALLOW_DEV_SEED', () => {
		expect(isDevAdminRouteAllowed({ ENVIRONMENT: 'production' } as Env)).toBe(false);
	});

	it('allows production when ALLOW_DEV_SEED=1', () => {
		expect(isDevAdminRouteAllowed({ ENVIRONMENT: 'production', ALLOW_DEV_SEED: '1' } as Env)).toBe(true);
	});

	it('allows local wrangler dev by default', () => {
		expect(isDevAdminRouteAllowed({} as Env)).toBe(true);
	});

	it('blocks local when ALLOW_DEV_SEED=0', () => {
		expect(isDevAdminRouteAllowed({ ALLOW_DEV_SEED: '0' } as Env)).toBe(false);
	});
});
