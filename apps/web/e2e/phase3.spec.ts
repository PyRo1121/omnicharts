import { test, expect } from '@playwright/test';
import {
	findKickOnlyChannelSlug,
	firstRankedSlug,
	ingestReachable,
	INGEST_URL,
	slugRedirectFromEnv,
	verifySlugHistoryRedirect
} from './helpers';

test.describe('Phase 3 E2E (docs/13 backlog)', () => {
	test('platform tab clicks update homepage URL', async ({ page }) => {
		await page.goto('/');
		const tabs = page.getByRole('tablist', { name: 'Platform' });

		await tabs.getByRole('tab', { name: 'Kick' }).click();
		await expect(page).toHaveURL(/\?.*platform=kick/);

		await tabs.getByRole('tab', { name: 'YouTube' }).click();
		await expect(page).toHaveURL(/\?.*platform=youtube/);

		await tabs.getByRole('tab', { name: 'Twitch' }).click();
		await expect(page).not.toHaveURL(/\?.*platform=/);
	});

	test('kick channel detail loads when ingest has rankings', async ({ page }) => {
		if (!(await ingestReachable())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL} — start: bun run dev:ingest`);
		}

		const slug = await firstRankedSlug('kick', 'channels');
		if (!slug) {
			test.skip(true, 'no kick channel rankings — run kick discover/checkpoint');
		}

		const res = await page.goto(`/channels/${slug}?platform=kick`);
		expect(res?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: /.+/ })).toBeVisible({
			timeout: 10_000
		});
	});

	test('kick game detail loads when ingest has rankings', async ({ page }) => {
		if (!(await ingestReachable())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL} — start: bun run dev:ingest`);
		}

		const slug = await firstRankedSlug('kick', 'games');
		if (!slug) {
			test.skip(true, 'no kick game rankings — run kick discover/checkpoint');
		}

		const res = await page.goto(`/games/${slug}?platform=kick`);
		expect(res?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1, name: /.+/ })).toBeVisible({
			timeout: 10_000
		});
	});

	test('slug 301 redirect when slug_history resolves', async ({ page }) => {
		if (!(await ingestReachable())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL} — start: bun run dev:ingest`);
		}

		const pair = slugRedirectFromEnv();
		if (!pair || !(await verifySlugHistoryRedirect(pair))) {
			test.skip(
				true,
				'set E2E_SLUG_REDIRECT=oldslug:newslug:twitch when ingest has slug_history'
			);
		}

		const response = await page.goto(
			`/channels/${encodeURIComponent(pair.oldSlug)}?platform=${pair.platform}`,
			{ waitUntil: 'commit' }
		);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveURL(
			new RegExp(`/channels/${encodeURIComponent(pair.newSlug)}\\?.*platform=${pair.platform}`)
		);
	});

	test('cross-platform 404 shows suggestions for kick-only channel', async ({ page }) => {
		if (!(await ingestReachable())) {
			test.skip(true, `ingest not reachable at ${INGEST_URL} — start: bun run dev:ingest`);
		}

		const slug = await findKickOnlyChannelSlug();
		if (!slug) {
			test.skip(true, 'no kick-only channel in rankings for cross-platform 404 probe');
		}

		const res = await page.goto(`/channels/${slug}?platform=twitch`);
		expect(res?.status()).toBe(404);
		await expect(page.getByText('Did you mean')).toBeVisible();
		await expect(page.getByRole('link', { name: /.+/ }).first()).toHaveAttribute(
			'href',
			`/channels/${slug}?platform=kick`
		);
	});
});
