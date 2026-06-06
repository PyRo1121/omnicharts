<script lang="ts">
	import { goto } from '$app/navigation';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import LeaderboardTable, { gameLeaderboardRows } from '$lib/components/ui/LeaderboardTable.svelte';
	import PeriodSelector from '$lib/components/ui/PeriodSelector.svelte';
	import PlatformFilter from '$lib/components/ui/PlatformFilter.svelte';
	import ExportCsvLink from '$lib/components/ui/ExportCsvLink.svelte';
	import { rankingsGamesCsvUrl } from '$lib/export/csv-url';
	import {
		gamesPageSubtitle,
		searchPlatformId,
		uiPeriods,
		platforms,
		routeWithPlatform,
		type UiPlatformFilter
	} from '$lib/ui/platform.svelte';
	import type { RankingPeriod } from '@omnicharts/domain';

	const { data } = $props();

	const rows = $derived(gameLeaderboardRows(data.rows));
	const subtitle = $derived(gamesPageSubtitle(data.platform, data.source));
	const csvHref = $derived(
		data.platform !== 'all' && data.rows.length > 0
			? rankingsGamesCsvUrl(searchPlatformId(data.platform), data.period, 20)
			: null
	);

	function platformHref(id: UiPlatformFilter): string {
		return routeWithPlatform('/games', id, { period: data.period });
	}

	function onPeriodChange(p: RankingPeriod) {
		goto(routeWithPlatform('/games', data.platform, { period: p }), {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

<svelte:head>
	<title>Top Games · OmniCharts</title>
</svelte:head>

<SectionHeader title="Games" {subtitle} />

<div class="mt-4">
	<PlatformFilter {platforms} value={data.platform} hrefFor={platformHref} />
</div>

{#if data.rows.length === 0}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		{data.source === 'unavailable'
			? 'Could not load rankings from ingest.'
			: data.period === '90d'
				? 'No games ranked for the 90-day window yet — check back as daily rollups accumulate.'
				: 'No games ranked for this period yet.'}
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
		rows={rows}
		metricHeader="Avg viewers"
		emptyMessage={data.rows.length === 0
			? data.source === 'unavailable'
				? 'Could not load rankings from ingest.'
				: data.period === '90d'
					? 'No games ranked for the 90-day window yet — check back as daily rollups accumulate.'
					: 'No games ranked for this period yet.'
			: null}
	/>
</div>
