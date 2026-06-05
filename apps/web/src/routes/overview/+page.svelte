<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import PlatformFilter from '$lib/components/ui/PlatformFilter.svelte';
	import {
		platforms,
		routeWithPlatform,
		overviewPageSubtitle,
		overviewTopGameLabel
	} from '$lib/ui/platform.svelte';

	const { data } = $props();

	function overviewHref(platform: (typeof platforms)[number]['id']): string {
		return routeWithPlatform('/overview', platform);
	}

	const subtitle = $derived(overviewPageSubtitle(data.platform, data.source));
	const rollupPlatformName = $derived(data.platform === 'kick' ? 'Kick' : 'YouTube');
	const topGameLabel = $derived(overviewTopGameLabel(data.platform));
</script>

<svelte:head>
	<title>Platform Overview · OmniCharts</title>
</svelte:head>

<SectionHeader title="Platform overview" {subtitle} />

<div class="mt-4">
	<PlatformFilter {platforms} value={data.platform} hrefFor={overviewHref} />
</div>

{#if data.ingestStatus}
	<p class="mt-2 text-xs text-[var(--color-oc-text-faint)]">Ingest status: {data.ingestStatus}</p>
{/if}

{#if data.stats.length === 0}
	<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
		No overview stats for this platform yet.
	</p>
{:else}
	<ul class="mt-8 grid gap-4 sm:grid-cols-3">
		{#each data.stats as stat (stat.label)}
			<li class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
				<p class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">
					{stat.label}
					{#if stat.source === 'mock'}
						<span
							class="ml-1 rounded bg-[var(--color-oc-bg-elevated)] px-1 py-0.5 text-[9px] font-semibold uppercase"
						>
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
{/if}

{#if data.topChannelName || data.topGameName}
	<div class="mt-8 grid gap-4 sm:grid-cols-2">
		{#if data.topChannelName}
			<p class="text-sm text-[var(--color-oc-text-muted)]">
				Top channel (7d): <span class="font-medium text-[var(--color-oc-text)]">{data.topChannelName}</span>
			</p>
		{/if}
		{#if data.topGameName}
			<p class="text-sm text-[var(--color-oc-text-muted)]">
				Top {topGameLabel} (7d):
				<span class="font-medium text-[var(--color-oc-text)]">{data.topGameName}</span>
			</p>
		{/if}
	</div>
{:else if (data.platform === 'kick' || data.platform === 'youtube') && data.source === 'unavailable'}
	<p class="mt-8 text-sm text-[var(--color-oc-text-muted)]">
		No {rollupPlatformName} rollups yet for this period — run discover and rollup when ingest is up.
	</p>
{/if}
