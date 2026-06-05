<script lang="ts">
	import { goto } from '$app/navigation';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import PeriodSelector from '$lib/components/ui/PeriodSelector.svelte';
	import LeaderboardTable from '$lib/components/ui/LeaderboardTable.svelte';
	import { uiPeriods } from '$lib/ui/platform.svelte';
	import type { RankingPeriod } from '@omnicharts/domain';

	let { data } = $props();
	const game = $derived(data.game);

	const metrics = $derived([
		{ label: 'Hours watched', value: game.totals.hoursWatched.toLocaleString() },
		{ label: 'Avg viewers', value: game.totals.averageViewers.toLocaleString() },
		{ label: 'Peak viewers', value: game.totals.peakViewers.toLocaleString() },
		{ label: 'Airtime (h)', value: game.totals.airtimeHours.toLocaleString() },
		{ label: 'Live channels (peak)', value: game.totals.liveChannels.toLocaleString() }
	]);

	const topChannelRows = $derived(
		game.topChannels.map((row) => ({
			rank: row.rank,
			href: `/channels/${row.slug}?platform=${game.platform}`,
			primary: row.displayName,
			imageUrl: row.avatarUrl,
			imageAlt: row.displayName,
			metric: row.hoursWatched,
			metricLabel: 'Hours watched',
			platform: game.platform as 'twitch'
		}))
	);

	function onPeriodChange(p: RankingPeriod) {
		const q = new URLSearchParams();
		q.set('platform', game.platform);
		q.set('period', p);
		goto(`/games/${game.slug}?${q}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>{game.name} Stats · OmniCharts</title>
</svelte:head>

<nav class="text-xs text-[var(--color-oc-text-faint)]">
	<a href="/games" class="hover:text-[var(--color-oc-accent)]">Games</a>
	<span class="mx-1">/</span>
	<span class="text-[var(--color-oc-text-muted)]">{game.name}</span>
</nav>

{#if game.source === 'error'}
	<SectionHeader title={game.slug} subtitle="Could not load game — is ingest running?" />
{:else}
	<header class="mt-4">
		<p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-oc-accent)]">
			{game.platform}
		</p>
		<h1
			class="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-oc-text)] sm:text-3xl"
		>
			{game.name}
		</h1>
	</header>

	<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
		<PeriodSelector periods={uiPeriods} value={game.period} onPeriodChange={onPeriodChange} />
		{#if data.periodNote}
			<p class="text-xs text-[var(--color-oc-text-faint)]">{data.periodNote}</p>
		{/if}
	</div>

	<ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
		{#each metrics as m (m.label)}
			<li class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-4">
				<p class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">{m.label}</p>
				<p class="mt-1 font-mono text-2xl font-semibold text-[var(--color-oc-text)]">{m.value}</p>
			</li>
		{/each}
	</ul>

	<section
		class="mt-8 rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5 sm:p-6"
		aria-label="Viewership over time"
	>
		<h2 class="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-oc-text)]">
			Viewership over time
		</h2>
		{#if game.daily.length >= 2}
			<div class="mt-4 min-h-[200px]">
				{#await import('$lib/components/ui/ViewershipChart.svelte')}
					<p class="text-xs text-[var(--color-oc-text-faint)]" aria-busy="true">Loading chart…</p>
				{:then { default: ViewershipChart }}
					<ViewershipChart daily={game.daily} />
				{/await}
			</div>
			<p class="mt-3 text-xs text-[var(--color-oc-text-faint)]">
				Daily rollup points for the selected period — each series scaled independently for shape comparison.
			</p>
		{:else}
			<p class="mx-auto mt-3 max-w-md text-center text-xs text-[var(--color-oc-text-muted)]">
				Not enough daily rollup history yet ({game.daily.length} day{game.daily.length === 1 ? '' : 's'} in
				period). Check back after ingest has recorded at least two days for this game.
			</p>
		{/if}
	</section>

	<section class="mt-8">
		<SectionHeader title="Top channels" subtitle="Ranked by hours watched in this category" />
		<div class="mt-4">
			{#if topChannelRows.length > 0}
				<LeaderboardTable rows={topChannelRows} metricHeader="Hours watched" />
			{:else if game.totals.hoursWatched > 0}
				<p class="text-sm text-[var(--color-oc-text-muted)]">
					No eligible channels in this category for the selected period yet — channels need tracked sessions
					and ranking airtime gates.
				</p>
			{:else}
				<p class="text-sm text-[var(--color-oc-text-muted)]">
					Top channels appear after game rollups exist for this period.
				</p>
			{/if}
		</div>
	</section>

	<p class="mt-6 text-sm text-[var(--color-oc-text-muted)]">
		Metrics from game daily rollups for the selected period.
		<a href="/methodology" class="text-[var(--color-oc-accent)] hover:underline">How we measure</a>
	</p>
{/if}
