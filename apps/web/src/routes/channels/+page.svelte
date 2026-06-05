<script lang="ts">
	import { goto } from '$app/navigation';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import LeaderboardTable from '$lib/components/ui/LeaderboardTable.svelte';
	import PeriodSelector from '$lib/components/ui/PeriodSelector.svelte';
	import PlatformFilter from '$lib/components/ui/PlatformFilter.svelte';
	import LanguageFilter from '$lib/components/ui/LanguageFilter.svelte';
	import { channelLeaderboardRows } from '$lib/components/ui/LeaderboardTable.svelte';
	import ExportCsvLink from '$lib/components/ui/ExportCsvLink.svelte';
	import { rankingsChannelsCsvUrl } from '$lib/export/csv-url';
	import {
		channelsPageSubtitle,
		searchPlatformId,
		uiPeriods,
		platforms,
		rankingLanguages,
		routeWithPlatform,
		type Period,
		type UiPlatformFilter
	} from '$lib/ui/platform.svelte';

	let { data } = $props();

	const rows = $derived(channelLeaderboardRows(data.rows));
	const subtitle = $derived(channelsPageSubtitle(data.platform, data.source));
	function routeQuery(period: Period = data.period): Record<string, string> {
		const q: Record<string, string> = { period };
		if (data.language) q.language = data.language;
		return q;
	}
	const csvHref = $derived(
		data.platform !== 'all' && data.rows.length > 0
			? rankingsChannelsCsvUrl(
					searchPlatformId(data.platform),
					data.period,
					20,
					data.language
				)
			: null
	);

	function platformHref(id: UiPlatformFilter): string {
		return routeWithPlatform('/channels', id, routeQuery());
	}

	function onPeriodChange(p: Period) {
		goto(routeWithPlatform('/channels', data.platform, routeQuery(p)), {
			keepFocus: true,
			noScroll: true
		});
	}

	function onLanguageChange(language: string | null) {
		const extra: Record<string, string> = { period: data.period };
		if (language) extra.language = language;
		goto(routeWithPlatform('/channels', data.platform, extra), {
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

{#if data.rows.length === 0}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		{data.source === 'unavailable'
			? 'Could not load rankings from ingest.'
			: data.language
				? 'No channels ranked for this language and period yet.'
				: data.period === '90d'
					? 'No channels ranked for the 90-day window yet — check back as daily rollups accumulate.'
					: 'No channels ranked for this period yet.'}
	</p>
{/if}

{#if data.languageNote}
	<p class="mt-2 text-xs text-[var(--color-oc-text-faint)]">{data.languageNote}</p>
{/if}

{#if data.updatedAt}
	<p class="mt-1 text-xs text-[var(--color-oc-text-faint)]">
		Updated {new Date(data.updatedAt).toLocaleString()}
	</p>
{/if}

<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
	<PeriodSelector periods={uiPeriods} value={data.period} onPeriodChange={onPeriodChange} />
	<LanguageFilter
		languages={rankingLanguages}
		value={data.language}
		onLanguageChange={onLanguageChange}
	/>
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
		emptyMessage={data.rows.length === 0
			? data.source === 'unavailable'
				? 'Could not load rankings from ingest.'
				: data.period === '90d'
					? 'No channels ranked for the 90-day window yet — check back as daily rollups accumulate.'
					: 'No channels ranked for this period yet.'
			: null}
	/>
</div>
