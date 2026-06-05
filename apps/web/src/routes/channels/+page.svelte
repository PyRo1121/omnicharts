<script lang="ts">
	import { goto } from '$app/navigation';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import LeaderboardTable from '$lib/components/ui/LeaderboardTable.svelte';
	import PeriodSelector from '$lib/components/ui/PeriodSelector.svelte';
	import PlatformFilter from '$lib/components/ui/PlatformFilter.svelte';
	import { channelLeaderboardRows } from '$lib/components/ui/LeaderboardTable.svelte';
	import ExportCsvLink from '$lib/components/ui/ExportCsvLink.svelte';
	import { rankingsChannelsCsvUrl } from '$lib/export/csv-url';
	import {
		channelsPageSubtitle,
		searchPlatformId,
		uiPeriods,
		platforms,
		routeWithPlatform,
		type Period,
		type PlatformId
	} from '$lib/ui/platform.svelte';

	let { data } = $props();

	const rows = $derived(channelLeaderboardRows(data.rows));
	const subtitle = $derived(channelsPageSubtitle(data.platform, data.source));
	const csvHref = $derived(
		data.platform !== 'all' && data.rows.length > 0
			? rankingsChannelsCsvUrl(searchPlatformId(data.platform), data.period)
			: null
	);

	function platformHref(id: PlatformId): string {
		return routeWithPlatform('/channels', id, { period: data.period });
	}

	function onPeriodChange(p: Period) {
		goto(routeWithPlatform('/channels', data.platform, { period: p }), {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

<svelte:head>
	<title>Top Channels · OmniCharts</title>
</svelte:head>

<SectionHeader title="Channels" {subtitle} />

<div class="mt-4">
	<PlatformFilter {platforms} value={data.platform} hrefFor={platformHref} />
</div>

{#if data.platformUnsupported}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		{data.platform === 'kick' ? 'Kick' : 'YouTube'} channel rankings ship in Phase 3. Switch to Twitch for
		live leaderboards.
	</p>
{:else if data.rows.length === 0}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		{data.source === 'unavailable'
			? 'Could not load rankings from ingest.'
			: data.period === '90d'
				? 'No channels ranked for the 90-day window yet — check back as daily rollups accumulate.'
				: 'No channels ranked for this period yet.'}
	</p>
{/if}

{#if data.updatedAt}
	<p class="mt-1 text-xs text-[var(--color-oc-text-faint)]">
		Updated {new Date(data.updatedAt).toLocaleString()}
	</p>
{/if}

<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
	<PeriodSelector periods={uiPeriods} value={data.period} onPeriodChange={onPeriodChange} />
	{#if csvHref}
		<ExportCsvLink href={csvHref} />
	{/if}
	{#if data.periodNote}
		<p class="text-xs text-[var(--color-oc-text-faint)]">{data.periodNote}</p>
	{/if}
</div>

<div class="mt-6">
	<LeaderboardTable
		{rows}
		metricHeader="Hours watched"
		emptyMessage={data.platformUnsupported
			? `${data.platform === 'kick' ? 'Kick' : 'YouTube'} channel rankings ship in Phase 3. Switch to Twitch for live leaderboards.`
			: data.rows.length === 0
				? data.source === 'unavailable'
					? 'Could not load rankings from ingest.'
					: data.period === '90d'
						? 'No channels ranked for the 90-day window yet — check back as daily rollups accumulate.'
						: 'No channels ranked for this period yet.'
				: null}
	/>
</div>
