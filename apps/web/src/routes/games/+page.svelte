<script lang="ts">
	import { goto } from '$app/navigation';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import LeaderboardTable from '$lib/components/ui/LeaderboardTable.svelte';
	import PeriodSelector from '$lib/components/ui/PeriodSelector.svelte';
	import { uiPeriods, platformQueryParam, type Period } from '$lib/mock/home';

	let { data } = $props();

	const rows = $derived(
		data.rows.map((g) => ({
			rank: g.rank,
			href: `/games/${g.slug}?platform=${g.platform}`,
			primary: g.name,
			imageUrl: g.boxArtUrl,
			imageAlt: g.name,
			metric: g.metric,
			metricLabel: g.metricLabel,
			platform: g.platform
		}))
	);

	function onPeriodChange(p: Period) {
		goto(`/games?period=${p}${platformQueryParam(data.platform)}`, {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

<svelte:head>
	<title>Top Games · OmniCharts</title>
</svelte:head>

<SectionHeader
	title="Games"
	subtitle={data.source === 'live'
		? data.platform === 'kick'
			? 'Top Kick categories by average viewers (ingest rollups).'
			: 'Top Twitch categories by average viewers (ingest rollups).'
		: data.source === 'mock'
			? 'Design preview — sample leaderboard (?demo=1).'
			: data.source === 'unavailable'
				? 'Ingest unavailable — start dev:ingest and run twitch:checkpoint.'
				: 'No game rollups for this period yet.'}
/>

{#if data.platformUnsupported}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		YouTube game rankings ship when YouTube ingest is live. Switch to Twitch or Kick for rollup-backed
		leaderboards.
	</p>
{:else if data.rows.length === 0}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		{data.source === 'unavailable'
			? 'Could not load rankings from ingest.'
			: 'No games ranked for this period yet.'}
	</p>
{/if}

{#if data.updatedAt}
	<p class="mt-1 text-xs text-[var(--color-oc-text-faint)]">
		Updated {new Date(data.updatedAt).toLocaleString()}
	</p>
{/if}

<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
	<PeriodSelector periods={uiPeriods} value={data.period} onchange={onPeriodChange} />
	{#if data.periodNote}
		<p class="text-xs text-[var(--color-oc-text-faint)]">{data.periodNote}</p>
	{/if}
</div>

<div class="mt-6">
	{#if !data.platformUnsupported && data.rows.length > 0}
		<LeaderboardTable rows={rows} metricHeader="Avg viewers" />
	{/if}
</div>
