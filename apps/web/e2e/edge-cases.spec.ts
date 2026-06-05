import { test, expect } from '@playwright/test';
import {
	clickPlatform,
	expectPlatformSelected,
	ingestRankingsReady,
	ingestReachable,
	INGEST_URL,
	platformNav
} from './helpers';

test.describe('Edge cases (docs/09, docs/13)', () => {
	test('invalid platform query falls back to Twitch tab', async ({ page }) => {
		const res = await page.goto('/?platform=notaplatform');
		expect(res?.status()).toBe(200);
		await expectPlatformSelected(page, 'Twitch');
		await expect(page.getByRole('heading', { name: 'Top streamers' })).toBeVisible();
	});

	test('unknown channel slug returns 404 with recovery links when ingest up', async ({ page }) => {
		if (!(await ingestRankingsReady())) {
			test.skip(true, `ingest rankings unavailable at ${INGEST_URL}`);
		}

		const res = await page.goto('/channels/definitely-not-a-real-slug-xyz?platform=twitch');
		expect(res?.status()).toBe(404);
		await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Search channels' })).toBeVisible();
	});

	test('unknown channel shows ingest error shell when ingest down', async ({ page }) => {
		if (await ingestReachable()) {
			test.skip(true, 'ingest is up — 404 path covered by prior test');
		}

		const res = await page.goto('/channels/definitely-not-a-real-slug-xyz?platform=twitch');
		expect(res?.status()).toBe(200);
		await expect(page.getByText(/Rankings service unavailable/i)).toBeVisible();
	});

	test('methodology page loads for each platform context', async ({ page }) => {
		for (const platform of ['twitch', 'kick', 'youtube'] as const) {
			const url = platform === 'twitch' ? '/methodology' : `/methodology?platform=${platform}`;
			const res = await page.goto(url);
			expect(res?.status()).toBe(200);
			await expect(
				page.getByRole('heading', { name: /How we measure streaming statistics/i })
			).toBeVisible();
		}
	});

	test('games invalid slug returns 404 when ingest has no match', async ({ page }) => {
		if (!(await ingestRankingsReady())) {
			test.skip(true, `ingest rankings unavailable at ${INGEST_URL}`);
		}

		const res = await page.goto('/games/not-a-real-game-slug-xyz?platform=twitch');
		expect(res?.status()).toBe(404);
		await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
	});

	test('platform nav on homepage cycles all three platforms', async ({ page }) => {
		await page.goto('/');
		await expect(platformNav(page)).toBeVisible();

		await clickPlatform(page, 'Kick');
		await expectPlatformSelected(page, 'Kick');

		await clickPlatform(page, 'YouTube');
		await expectPlatformSelected(page, 'YouTube');

		await clickPlatform(page, 'Twitch');
		await expectPlatformSelected(page, 'Twitch');
	});

	test('youtube demo channel rankings show design preview footnote', async ({ page }) => {
		await page.goto('/channels?platform=youtube&demo=1');
		await expect(page.getByText(/design preview/i).first()).toBeVisible();
	});
});
