import { test, expect } from '@playwright/test';
import { expectPlatformSelected } from './helpers';

test.describe('YouTube platform UX (docs/09, docs/05)', () => {
	test('homepage ?platform=youtube shows rankings UI without Phase 3 banner', async ({ page }) => {
		const res = await page.goto('/?platform=youtube');
		expect(res?.status()).toBe(200);

		await expect(page.getByText(/YouTube rankings ship in Phase 3/i)).not.toBeVisible();
		await expect(page.getByRole('heading', { name: 'Top streamers' })).toBeVisible();

		const streamers = page.locator('section').filter({ hasText: 'Top streamers' });
		await expect(streamers.locator('table tbody td').first()).toBeVisible({ timeout: 10_000 });

		await expect(page.getByText(/Live YouTube rollups ·|Ingest unavailable/i)).toBeVisible();
	});

	test('homepage ?platform=youtube&demo=1 shows design preview rankings', async ({ page }) => {
		const res = await page.goto('/?platform=youtube&demo=1');
		expect(res?.status()).toBe(200);

		await expect(page.getByText(/design preview/i).first()).toBeVisible();
		const streamers = page.locator('section').filter({ hasText: 'Top streamers' });
		await expect(streamers.locator('table tbody td').first()).toBeVisible({ timeout: 10_000 });
	});

	test('overview ?platform=youtube loads rollup-backed shell without Phase 3 banner', async ({ page }) => {
		const res = await page.goto('/overview?platform=youtube');
		expect(res?.status()).toBe(200);

		await expect(page.getByText(/YouTube overview cards ship when YouTube ingest is live/i)).not.toBeVisible();
		await expect(page.getByText(/YouTube rollup-backed counts when ingest has data|YouTube ingest unavailable/i)).toBeVisible();
		await expectPlatformSelected(page, 'YouTube');
		await expect(page.getByText(/Channels tracked/i)).toBeVisible();
	});

	test('channels page ?platform=youtube loads without Phase 3 banner', async ({ page }) => {
		const res = await page.goto('/channels?platform=youtube');
		expect(res?.status()).toBe(200);

		await expect(page.getByText(/ship in Phase 3/i)).not.toBeVisible();
		await expect(page.getByText(/Top YouTube channels by hours watched|Ingest unavailable|No channels ranked/i).first()).toBeVisible();
	});

	test('games page ?platform=youtube loads without Phase 3 banner', async ({ page }) => {
		const res = await page.goto('/games?platform=youtube');
		expect(res?.status()).toBe(200);

		await expect(page.getByText(/YouTube game rankings ship/i)).not.toBeVisible();
		await expect(
			page.getByText(/Top YouTube categories by average viewers|Ingest unavailable|No games ranked for this period yet/i).first(),
		).toBeVisible();
	});
});
