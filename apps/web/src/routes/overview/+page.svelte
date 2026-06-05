<script lang="ts">
	import { goto } from '$app/navigation';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import PlatformFilter from '$lib/components/ui/PlatformFilter.svelte';
	import { platforms, type PlatformId } from '$lib/mock/home';

	let { data } = $props();

	function onPlatformChange(id: PlatformId) {
		const q = id === 'twitch' ? '/overview' : `/overview?platform=${id}`;
		goto(q, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>Platform Overview · OmniCharts</title>
</svelte:head>

<SectionHeader
	title="Platform overview"
	subtitle={data.platformUnsupported
		? `${data.platform === 'kick' ? 'Kick' : 'YouTube'} overview cards ship in Phase 3.`
		: data.source === 'live'
			? 'Twitch ingest health and rollup-backed counts.'
			: data.source === 'mock'
				? 'Design preview stats (?demo=1).'
				: 'Ingest unavailable — start dev:ingest for live overview.'}
/>

<div class="mt-4">
	<PlatformFilter {platforms} value={data.platform} onchange={onPlatformChange} />
</div>

{#if data.platformUnsupported}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		Switch to Twitch for live ingest stats and rollup-backed overview cards.
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
					{#if stat.source === 'mock'}
						<span class="ml-1 rounded bg-[var(--color-oc-bg-elevated)] px-1 py-0.5 text-[9px] font-semibold uppercase">
							demo
						</span>
					{/if}
				</p>
				<p class="mt-2 font-mono text-3xl font-semibold tabular-nums text-[var(--color-oc-text)]">
					{stat.value}
				</p>
				<p class="mt-1 text-xs text-[var(--color-oc-text-muted)]">{stat.hint}</p>
			</li>
		{/each}
	</ul>

	{#if data.topChannelName || data.topGameName}
		<div class="mt-8 grid gap-4 sm:grid-cols-2">
			{#if data.topChannelName}
				<p class="text-sm text-[var(--color-oc-text-muted)]">
					Top channel (7d): <span class="font-medium text-[var(--color-oc-text)]">{data.topChannelName}</span>
				</p>
			{/if}
			{#if data.topGameName}
				<p class="text-sm text-[var(--color-oc-text-muted)]">
					Top game (7d): <span class="font-medium text-[var(--color-oc-text)]">{data.topGameName}</span>
				</p>
			{/if}
		</div>
	{/if}
{/if}
