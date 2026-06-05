import { describe, it, expect } from 'vitest';
import { testEnv } from './helpers';
import { isDevAdminRouteAllowed } from '../src/dev/admin-guard';

describe('isDevAdminRouteAllowed', () => {
	it('blocks production without ALLOW_DEV_SEED', () => {
		expect(isDevAdminRouteAllowed(testEnv({ ENVIRONMENT: 'production' }))).toBe(false);
	});

	it('allows production when ALLOW_DEV_SEED=1', () => {
		expect(isDevAdminRouteAllowed(testEnv({ ENVIRONMENT: 'production', ALLOW_DEV_SEED: '1' }))).toBe(true);
	});

	it('allows local wrangler dev by default', () => {
		expect(isDevAdminRouteAllowed(testEnv())).toBe(true);
	});

	it('blocks local when ALLOW_DEV_SEED=0', () => {
		expect(isDevAdminRouteAllowed(testEnv({ ALLOW_DEV_SEED: '0' }))).toBe(false);
	});
});
