/** POST /admin/dev/* — blocked in production unless ALLOW_DEV_SEED=1. */
export function isDevAdminRouteAllowed(env: Env): boolean {
	if (env.ENVIRONMENT === 'production') {
		return env.ALLOW_DEV_SEED === '1';
	}
	return env.ALLOW_DEV_SEED !== '0';
}
