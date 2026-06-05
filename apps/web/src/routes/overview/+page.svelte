<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import PlatformFilter from '$lib/components/ui/PlatformFilter.svelte';
	import { platforms, type PlatformId } from '$lib/mock/home';

	let { data } = $props();
	let platform = $state<PlatformId>('twitch');
</script>

<svelte:head>
	<title>Platform Overview · OmniCharts</title>
</svelte:head>

<SectionHeader
	title="Platform overview"
	subtitle={data.source === 'live'
		? 'Twitch ingest health and rollup-backed counts.'
		: data.source === 'mock'
			? 'Design preview stats (?demo=1).'
			: 'Ingest unavailable — start dev:ingest for live overview.'}
/>

<div class="mt-4">
	<PlatformFilter {platforms} value={platform} onchange={(id) => (platform = id)} />
</div>

{#if platform !== 'twitch' && platform !== 'all'}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		{platform === 'kick' ? 'Kick' : 'YouTube'} overview cards ship in Phase 3.
	</p>
{:else}
	{#if data.ingestStatus}
		<p class="mt-2 text-xs text-[var(--color-oc-text-faint)]">Ingest status: {data.ingestStatus}</p>
	{/if}

	<ul class="mt-8 grid gap-4 sm:grid-cols-3">
		{#each data.stats as stat (stat.label)}
			<li class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
				<p class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">
					{stat.label}
					{#if stat.source === 'mock' || data.source === 'mock'}
						<span class="ml-1 rounded px-1 text-[9px] font-semibold uppercase text-[var(--color-oc-text-muted)]">
							demo
						</span>
					{/if}
				</p>
				<p class="mt-2 font-mono text-3xl font-semibold text-[var(--color-oc-text)]">{stat.value}</p>
				<p class="mt-1 text-xs text-[var(--color-oc-text-muted)]">{stat.hint}</p>
			</li>
		{/each}
	</ul>

	{#if data.topChannelName || data.topGameName}
		<div class="mt-8 grid gap-4 sm:grid-cols-2">
			{#if data.topChannelName}
				<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
					<p class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Top channel (7d HW)</p>
					<p class="mt-2 text-lg font-semibold text-[var(--color-oc-text)]">{data.topChannelName}</p>
				</div>
			{/if}
			{#if data.topGameName}
				<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
					<p class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Top category (7d AV)</p>
					<p class="mt-2 text-lg font-semibold text-[var(--color-oc-text)]">{data.topGameName}</p>
				</div>
			{/if}
		</div>
	{/if}
{/if}
