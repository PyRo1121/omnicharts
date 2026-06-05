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

test.describe('OmniCharts smoke (REM-035)', () => {
	test('homepage loads with 200', async ({ page }) => {
		const res = await page.goto('/');
		expect(res?.status()).toBe(200);
		await expect(page).toHaveTitle(/OmniCharts/i);
		await expect(page.locator('#channel-search')).toBeVisible();
	});

	test('search flow opens results panel when query length >= 2', async ({ page }) => {
		await page.goto('/');
		const input = page.locator('#channel-search');
		await input.fill('sh');
		await expect(page.getByRole('listbox')).toBeVisible({ timeout: 10_000 });
	});

	test('channel page loads when ingest has rankings', async ({ page }) => {
		if (!(await ingestReachable())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL} — start: bun run dev:ingest`);
		}

		const rankingsRes = await fetch(`${INGEST_URL}/v1/rankings/channels?platform=twitch&period=7d&limit=1`);
		if (!rankingsRes.ok) {
			test.skip(true, 'rankings endpoint unavailable');
		}
		const rankings = (await rankingsRes.json()) as { items?: { slug?: string }[] };
		const slug = rankings.items?.[0]?.slug;
		if (!slug) {
			test.skip(true, 'no ranked channels — run bun run twitch:checkpoint');
		}

		const res = await page.goto(`/channels/${slug}?platform=twitch`);
		expect(res?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: /.+/ })).toBeVisible({
			timeout: 10_000,
		});
	});
});
