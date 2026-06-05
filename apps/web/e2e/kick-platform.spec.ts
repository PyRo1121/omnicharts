import { test, expect } from '@playwright/test';
import {
	clickPlatform,
	expectPlatformSelected,
	ingestReachable,
	INGEST_URL
} from './helpers';

test.describe('Kick platform UX (docs/09, docs/16)', () => {
	test('homepage ?platform=kick shows rankings UI without Phase 3 banner', async ({ page }) => {
		const res = await page.goto('/?platform=kick');
		expect(res?.status()).toBe(200);

		await expect(page.getByText(/Kick rankings ship in Phase 3/i)).not.toBeVisible();
		await expect(page.getByText(/Switch to Twitch for live[\s\S]*leaderboards/i)).not.toBeVisible();

		await expect(page.getByRole('heading', { name: 'Top streamers' })).toBeVisible();

		const streamers = page.locator('section').filter({ hasText: 'Top streamers' });
		await expect(streamers.locator('table tbody td').first()).toBeVisible({ timeout: 10_000 });

		const statusLine = page.getByText(/Live Kick rollups ·|Ingest unavailable/i);
		await expect(statusLine).toBeVisible();

		await expect(page.getByRole('heading', { name: 'Top categories' })).toBeVisible();
		const categories = page.locator('section').filter({ hasText: 'Top categories' });
		await expect(categories.locator('table tbody td').first()).toBeVisible({ timeout: 10_000 });
	});

	test('games page ?platform=kick loads without Phase 3 banner', async ({ page }) => {
		const res = await page.goto('/games?platform=kick');
		expect(res?.status()).toBe(200);
		await expect(page.getByText(/Kick game rankings ship in Phase 3/i)).not.toBeVisible();
		await expect(
			page.getByText(/Top Kick categories by average viewers|Ingest unavailable/i)
		).toBeVisible();
	});

	test('overview ?platform=kick loads without Phase 3 banner', async ({ page }) => {
		const res = await page.goto('/overview?platform=kick');
		expect(res?.status()).toBe(200);
		await expect(page.getByText(/Kick overview cards ship in Phase 3/i)).not.toBeVisible();
		await expect(
			page.getByText(/Kick (rollup-backed counts when ingest has data|ingest unavailable)/i)
		).toBeVisible();
		await expectPlatformSelected(page, 'Kick');
		await expect(page.getByText(/Channels tracked/i)).toBeVisible();
	});

	test('overview ?platform=youtube selects YouTube tab with platform copy', async ({ page }) => {
		const res = await page.goto('/overview?platform=youtube');
		expect(res?.status()).toBe(200);
		await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
		await expectPlatformSelected(page, 'YouTube');
		await expect(
			page.getByText(/YouTube (rollup-backed counts|ingest unavailable)/i).first()
		).toBeVisible();
	});

	test('homepage ?platform=youtube selects YouTube tab and leaderboard shell', async ({ page }) => {
		const res = await page.goto('/?platform=youtube');
		expect(res?.status()).toBe(200);
		await expectPlatformSelected(page, 'YouTube');
		await expect(page.getByRole('heading', { name: 'Top streamers' })).toBeVisible();
	});

	test('channels page ?platform=youtube selects YouTube tab', async ({ page }) => {
		const res = await page.goto('/channels?platform=youtube');
		expect(res?.status()).toBe(200);
		await expectPlatformSelected(page, 'YouTube');
	});

	test('games page ?platform=youtube shows YouTube copy', async ({ page }) => {
		const res = await page.goto('/games?platform=youtube');
		expect(res?.status()).toBe(200);
		await expectPlatformSelected(page, 'YouTube');
		await expect(
			page.getByText(/Top YouTube categories|Ingest unavailable/i).first()
		).toBeVisible();
	});

	test('search page accepts platform=kick query param', async ({ page }) => {
		const res = await page.goto('/search?q=te&platform=kick');
		expect(res?.status()).toBe(200);
		await expect(page).toHaveTitle(/Search channels/i);
		await expect(page.locator('#channel-search')).toBeVisible();
	});

	test('search page subtitle reflects platform=kick', async ({ page }) => {
		const res = await page.goto('/search?platform=kick');
		expect(res?.status()).toBe(200);
		await expect(page.getByText(/Find streamers by name or slug on Kick/i)).toBeVisible();
	});

	test('sidebar nav preserves ?platform=kick across directory pages', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto('/channels?platform=kick');
		await expectPlatformSelected(page, 'Kick');
		await expect(
			page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Games' })
		).toHaveAttribute('href', /platform=kick/);

		await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Games' }).click();
		await expect(page).toHaveURL(/\/games\?.*platform=kick/);
		await expectPlatformSelected(page, 'Kick');

		await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Overview' }).click();
		await expect(page).toHaveURL(/\/overview\?.*platform=kick/);
		await expectPlatformSelected(page, 'Kick');
	});

	test('platform filter on channels updates URL and tab', async ({ page }) => {
		await page.goto('/channels');
		await expectPlatformSelected(page, 'Twitch');

		await clickPlatform(page, 'Kick');
		await expect(page).toHaveURL(/\/channels\?.*platform=kick/);
		await expectPlatformSelected(page, 'Kick');
	});

	test('search page shows PlatformFilter synced with URL', async ({ page }) => {
		await page.goto('/search?platform=kick');
		await expectPlatformSelected(page, 'Kick');
		await clickPlatform(page, 'Twitch');
		await expect(page).not.toHaveURL(/platform=kick/);
		await expectPlatformSelected(page, 'Twitch');
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
