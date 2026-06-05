import { isComparePeriod, isPlatformId, parseComparePeriod, type ComparePeriod, PLATFORM_TWITCH } from '@omnicharts/domain';
import type { D1Database } from './d1';
import { buildChannelDetailResponse, type ChannelDetailResponse } from './channel-api';

export type CompareChannelsQueryError = 'invalid_platform' | 'invalid_period' | 'missing_slugs';

export type ParsedCompareChannelsQuery =
	| { ok: true; platform: string; period: ComparePeriod; a: string; b: string }
	| { ok: false; error: CompareChannelsQueryError };

export type CompareChannelSide = {
	slug: string;
	found: boolean;
	channel: ChannelDetailResponse | null;
};

export type CompareChannelsResponse = {
	platform: string;
	period: ComparePeriod;
	updated_at: string;
	a: CompareChannelSide;
	b: CompareChannelSide;
};

function normalizeSlug(raw: string | null): string | null {
	const trimmed = raw?.trim();
	return trimmed ? trimmed : null;
}

export function parseCompareChannelsQuery(url: URL): ParsedCompareChannelsQuery {
	const platformRaw = url.searchParams.get('platform') ?? PLATFORM_TWITCH;
	if (!isPlatformId(platformRaw)) {
		return { ok: false, error: 'invalid_platform' };
	}

	const a = normalizeSlug(url.searchParams.get('a'));
	const b = normalizeSlug(url.searchParams.get('b'));
	if (!a || !b) {
		return { ok: false, error: 'missing_slugs' };
	}

	const periodRaw = url.searchParams.get('period');
	if (periodRaw != null && periodRaw !== '' && !isComparePeriod(periodRaw)) {
		return { ok: false, error: 'invalid_period' };
	}
	const period = parseComparePeriod(periodRaw);
	return { ok: true, platform: platformRaw, period, a, b };
}

async function loadCompareSide(
	db: D1Database,
	opts: { platform: string; slug: string; period: ComparePeriod },
): Promise<CompareChannelSide> {
	const channel = await buildChannelDetailResponse(db, opts);
	return {
		slug: opts.slug,
		found: channel != null,
		channel,
	};
}

export async function buildCompareChannelsResponse(
	db: D1Database,
	opts: { platform: string; period: ComparePeriod; a: string; b: string },
): Promise<CompareChannelsResponse> {
	const [a, b] = await Promise.all([
		loadCompareSide(db, { platform: opts.platform, slug: opts.a, period: opts.period }),
		loadCompareSide(db, { platform: opts.platform, slug: opts.b, period: opts.period }),
	]);

	return {
		platform: opts.platform,
		period: opts.period,
		updated_at: new Date().toISOString(),
		a,
		b,
	};
}
