import { defineConfig } from 'vitest/config';
import { omnichartsResolveAlias } from './omnicharts-resolve.mts';

export default defineConfig({
	resolve: {
		alias: { ...omnichartsResolveAlias },
	},
	test: {
		projects: ['./vitest.unit.config.mts', './vitest.workers.config.mts'],
	},
});
