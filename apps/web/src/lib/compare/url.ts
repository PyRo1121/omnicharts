import { comparePeriods, parseComparePeriod, type ComparePeriod } from '@omnicharts/domain';
import type { PlatformId } from '@omnicharts/domain';
import { parseUiPlatform, searchPlatformId } from '$lib/ui/platform.svelte';

export type ComparePageParams = {
	a: string | null;
	b: string | null;
	platform: PlatformId;
	period: ComparePeriod;
};

export function comparePageUrl(params: ComparePageParams): string {
	const q = new URLSearchParams();
	if (params.a) q.set('a', params.a);
	if (params.b) q.set('b', params.b);
	if (params.platform === 'kick' || params.platform === 'youtube') {
		q.set('platform', params.platform);
	}
	if (params.period !== '7d') q.set('period', params.period);
	const qs = q.toString();
	return qs ? `/compare?${qs}` : '/compare';
}

export function parseComparePageParams(url: URL): ComparePageParams {
	return {
		a: normalizeCompareSlug(url.searchParams.get('a')),
		b: normalizeCompareSlug(url.searchParams.get('b')),
		platform: searchPlatformId(parseUiPlatform(url.searchParams.get('platform'))),
		period: parseComparePeriod(url.searchParams.get('period'))
	};
}

export function normalizeCompareSlug(raw: string | null): string | null {
	const trimmed = raw?.trim();
	return trimmed ? trimmed : null;
}

/** @deprecated Use `parseComparePeriod` from `@omnicharts/domain`. */
export const parseComparePagePeriod = parseComparePeriod;

export { comparePeriods };
