import { defineConfig, devices } from '@playwright/test';

const previewPort = 4173;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${previewPort}`;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command:
			'bun run wrangler d1 migrations apply omnicharts --local && bun run dev -- --port 4173 --host 127.0.0.1',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			...process.env,
			INGEST_URL: process.env.INGEST_URL ?? 'http://127.0.0.1:8787'
		}
	}
});
