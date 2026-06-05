import { test, expect } from '@playwright/test';

const INGEST_URL = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';

async function ingestReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${INGEST_URL}/health`, { signal: AbortSignal.timeout(3000) });
		return res.ok;
	} catch {
		return false;
	}
}

test.describe('Kick platform UX (docs/09, docs/16)', () => {
	test('homepage ?platform=kick shows honest Phase 3 banner', async ({ page }) => {
		const res = await page.goto('/?platform=kick');
		expect(res?.status()).toBe(200);
		await expect(page.getByText(/Kick rankings ship in Phase 3/i)).toBeVisible();
		await expect(page.getByText(/Switch to Twitch for live[\s\S]*leaderboards/i)).toBeVisible();
	});

	test('search page accepts platform=kick query param', async ({ page }) => {
		const res = await page.goto('/search?q=te&platform=kick');
		expect(res?.status()).toBe(200);
		await expect(page).toHaveTitle(/Search channels/i);
		await expect(page.locator('#channel-search')).toBeVisible();
	});

	test('kick search returns results when ingest has kick channels', async ({ page }) => {
		if (!(await ingestReachable())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL} — start: bun run dev:ingest`);
		}

		const searchRes = await fetch(
			`${INGEST_URL}/v1/search/channels?q=te&platform=kick&limit=1`
		);
		if (!searchRes.ok) {
			test.skip(true, 'kick search endpoint unavailable');
		}

		const body = (await searchRes.json()) as { results?: unknown[] };
		if (!body.results?.length) {
			test.skip(true, 'no kick channels in ingest — run kick discover/checkpoint');
		}

		await page.goto('/search?q=te&platform=kick');
		await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/Kick/i).first()).toBeVisible();
	});
});
