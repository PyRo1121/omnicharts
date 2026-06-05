import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		name: 'workers',
		include: ['test/index.spec.ts', 'test/twitch.spec.ts', 'test/eventsub-verify.spec.ts'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					// Match installed workerd in @cloudflare/vitest-pool-workers (avoids [mf:warn] fallback noise).
					compatibilityDate: '2026-03-10',
				},
			},
		},
	},
});
