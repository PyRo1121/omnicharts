import { test, expect } from '@playwright/test';
import {
	firstRankedSlug,
	ingestRankingsReady,
	INGEST_URL
} from './helpers';

test.describe('Compare page (Phase 4 slice 4.4)', () => {
	test('compare picker renders without slugs', async ({ page }) => {
		const res = await page.goto('/compare');
		expect(res?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: /Compare streamers/i })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Compare' })).toBeVisible();
		await expect(page.getByText(/Enter two channel slugs/i)).toBeVisible();
	});

	test('compare page shows honest empty for missing channel', async ({ page }) => {
		if (!(await ingestRankingsReady())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL} — start: bun run dev:ingest`);
		}

		const slug = await firstRankedSlug('twitch', 'channels');
		if (!slug) {
			test.skip(true, 'no twitch channel rankings');
		}

		const res = await page.goto(
			`/compare?a=${encodeURIComponent(slug)}&b=definitely-not-a-channel-xyz&platform=twitch&period=7d`
		);
		expect(res?.status()).toBe(200);
		await expect(page.getByText(/Channel not found/i)).toBeVisible();
		await expect(page.getByRole('table', { name: /Side-by-side channel metrics/i })).toBeVisible();
	});

	test('compare page loads side-by-side metrics for two ranked channels', async ({ page }) => {
		if (!(await ingestRankingsReady())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL} — start: bun run dev:ingest`);
		}

		const res = await fetch(`${INGEST_URL}/v1/rankings/channels?platform=twitch&period=7d&limit=2`);
		if (!res.ok) test.skip(true, 'rankings unavailable');
		const body = (await res.json()) as { items?: { slug?: string }[] };
		const slugs = (body.items ?? []).map((item) => item.slug).filter(Boolean) as string[];
		if (slugs.length < 2) {
			test.skip(true, 'need at least two ranked twitch channels');
		}

		const [a, b] = slugs;
		const pageRes = await page.goto(
			`/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&platform=twitch&period=7d`
		);
		expect(pageRes?.status()).toBe(200);
		await expect(page.getByRole('table', { name: /Side-by-side channel metrics/i })).toBeVisible();
		await expect(page.getByText('Hours watched').first()).toBeVisible();
	});

	test('compare period toggle updates URL to 30d', async ({ page }) => {
		if (!(await ingestRankingsReady())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL}`);
		}

		const slug = await firstRankedSlug('twitch', 'channels');
		if (!slug) test.skip(true, 'no twitch rankings');

		await page.goto(
			`/compare?a=${encodeURIComponent(slug)}&b=${encodeURIComponent(slug)}&platform=twitch&period=7d`
		);
		await page.getByRole('group', { name: 'Time period' }).getByRole('link', { name: '30 days' }).click();
		await expect(page).toHaveURL(/period=30d/);
	});
});
