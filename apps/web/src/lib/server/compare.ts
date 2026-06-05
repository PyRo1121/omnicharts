import type { ComparePeriod } from '@omnicharts/domain';
import { loadChannelDetail, type ChannelDetailLoad } from '$lib/server/channel';
import type { ServerLoadContext } from '$lib/server/load-context';
import { normalizeCompareSlug } from '$lib/compare/url';
import type { PlatformId } from '@omnicharts/domain';
import { searchPlatformId } from '$lib/ui/platform.svelte';

export type CompareSideLoad = ChannelDetailLoad & {
	slugParam: string;
	hasRollupMetrics: boolean;
};

export type ChannelCompareLoad = {
	platform: string;
	period: ComparePeriod;
	a: CompareSideLoad | null;
	b: CompareSideLoad | null;
};

export function parseCompareSlugs(aRaw: string | null, bRaw: string | null): { a: string | null; b: string | null } {
	return {
		a: normalizeCompareSlug(aRaw),
		b: normalizeCompareSlug(bRaw),
	};
}

export function channelHasRollupMetrics(channel: ChannelDetailLoad): boolean {
	if (channel.source !== 'live' || channel.ingestState === 'discovered') return false;
	return channel.daily.length > 0 || channel.totals.hoursWatched > 0 || channel.totals.airtimeHours > 0;
}

function mapSide(channel: ChannelDetailLoad, slugParam: string): CompareSideLoad {
	return {
		...channel,
		slugParam,
		hasRollupMetrics: channelHasRollupMetrics(channel),
	};
}

export async function loadChannelCompare(
	ctx: ServerLoadContext,
	opts: { a: string | null; b: string | null; platform: PlatformId; period: ComparePeriod },
): Promise<ChannelCompareLoad> {
	const platform = searchPlatformId(opts.platform);
	const loads: Promise<CompareSideLoad | null>[] = [];

	if (opts.a) {
		loads.push(loadChannelDetail(ctx, opts.a, platform, opts.period).then((channel) => mapSide(channel, opts.a!)));
	} else {
		loads.push(Promise.resolve(null));
	}

	if (opts.b) {
		loads.push(loadChannelDetail(ctx, opts.b, platform, opts.period).then((channel) => mapSide(channel, opts.b!)));
	} else {
		loads.push(Promise.resolve(null));
	}

	const [a, b] = await Promise.all(loads);
	return { platform, period: opts.period, a, b };
}
