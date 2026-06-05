import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const INGEST_URL = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';

/** PlatformFilter — nav links with aria-current (docs/09). */
export function platformNav(page: Page) {
	return page.getByRole('navigation', { name: 'Platform' });
}

export async function expectPlatformSelected(page: Page, name: string) {
	await expect(platformNav(page).getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
}

export async function clickPlatform(page: Page, name: string) {
	await platformNav(page).getByRole('link', { name, exact: true }).click();
}

export async function ingestReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${INGEST_URL}/health`, { signal: AbortSignal.timeout(3000) });
		return res.ok;
	} catch {
		return false;
	}
}

/** Health + rankings API — gates ingest-dependent 404/detail e2e. */
export async function ingestRankingsReady(): Promise<boolean> {
	if (!(await ingestReachable())) return false;
	try {
		const res = await fetch(`${INGEST_URL}/v1/rankings/channels?platform=twitch&period=7d&limit=1`, { signal: AbortSignal.timeout(5000) });
		return res.ok;
	} catch {
		return false;
	}
}

type RankedItem = { slug?: string };

export async function firstRankedSlug(platform: 'twitch' | 'kick', kind: 'channels' | 'games'): Promise<string | null> {
	const res = await fetch(`${INGEST_URL}/v1/rankings/${kind}?platform=${platform}&period=7d&limit=5`, {
		signal: AbortSignal.timeout(5000),
	});
	if (!res.ok) return null;
	const body = (await res.json()) as { items?: RankedItem[] };
	return body.items?.find((item) => item.slug)?.slug ?? null;
}

export async function channelExistsOnPlatform(slug: string, platform: string): Promise<boolean> {
	const res = await fetch(`${INGEST_URL}/v1/channels/${encodeURIComponent(slug)}?platform=${encodeURIComponent(platform)}&period=7d`, {
		signal: AbortSignal.timeout(5000),
	});
	return res.ok;
}

export async function findKickOnlyChannelSlug(): Promise<string | null> {
	const res = await fetch(`${INGEST_URL}/v1/rankings/channels?platform=kick&period=7d&limit=10`, { signal: AbortSignal.timeout(5000) });
	if (!res.ok) return null;
	const body = (await res.json()) as { items?: RankedItem[] };
	for (const item of body.items ?? []) {
		const slug = item.slug;
		if (!slug) continue;
		const [onKick, onTwitch] = await Promise.all([channelExistsOnPlatform(slug, 'kick'), channelExistsOnPlatform(slug, 'twitch')]);
		if (onKick && !onTwitch) return slug;
	}
	return null;
}

export type SlugHistoryPair = { oldSlug: string; newSlug: string; platform: string };

/** Optional: E2E_SLUG_REDIRECT=oldslug:newslug:twitch */
export function slugRedirectFromEnv(): SlugHistoryPair | null {
	const raw = process.env.E2E_SLUG_REDIRECT?.trim();
	if (!raw) return null;
	const [oldSlug, newSlug, platform = 'twitch'] = raw.split(':');
	if (!oldSlug || !newSlug) return null;
	return { oldSlug, newSlug, platform };
}

export async function verifySlugHistoryRedirect(pair: SlugHistoryPair): Promise<boolean> {
	const params = new URLSearchParams({ slug: pair.oldSlug, platform: pair.platform });
	const res = await fetch(`${INGEST_URL}/v1/channels/resolve?${params}`, {
		signal: AbortSignal.timeout(5000),
	});
	if (!res.ok) return false;
	const body = (await res.json()) as { slug?: string; from_history?: boolean };
	return body.from_history === true && body.slug === pair.newSlug;
}
