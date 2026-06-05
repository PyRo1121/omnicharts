<script lang="ts">
	import AvatarImage from '$lib/components/ui/AvatarImage.svelte';
	import { comparePageUrl, comparePeriods } from '$lib/compare/url';
	import { cn } from '$lib/utils/cn';
	import type { ComparePeriod } from '@omnicharts/domain';
	import { ingestStateLabel } from '$lib/ingest-state-label';
	import type { CompareSideLoad } from '$lib/server/compare';
	import { platformLabel, routeWithPlatform } from '$lib/ui/platform.svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let slugA = $state('');
	let slugB = $state('');

	$effect(() => {
		slugA = data.a?.slugParam ?? '';
		slugB = data.b?.slugParam ?? '';
	});

	const metricRows = [
		{ key: 'hoursWatched', label: 'Hours watched' },
		{ key: 'averageViewers', label: 'Avg viewers' },
		{ key: 'peakViewers', label: 'Peak viewers' },
		{ key: 'airtimeHours', label: 'Airtime (h)' }
	] as const;

	const periodLabels: Record<ComparePeriod, string> = {
		'7d': '7 days',
		'30d': '30 days',
		'90d': '90 days'
	};

	function comparePeriodHref(period: ComparePeriod): string {
		const a = (data.a?.slugParam ?? slugA).trim();
		const b = (data.b?.slugParam ?? slugB).trim();
		return comparePageUrl({
			a: a || null,
			b: b || null,
			platform: data.platform === 'kick' || data.platform === 'youtube' ? data.platform : 'twitch',
			period
		});
	}

	function submitCompare(event: SubmitEvent) {
		event.preventDefault();
		const a = slugA.trim();
		const b = slugB.trim();
		if (!a || !b) return;
		goto(
			comparePageUrl({
				a,
				b,
				platform: data.platform === 'kick' || data.platform === 'youtube' ? data.platform : 'twitch',
				period: data.period
			})
		);
	}

	function sideStatus(side: CompareSideLoad | null): 'empty' | 'missing' | 'discovered' | 'error' | 'ready' {
		if (!side) return 'empty';
		if (side.source === 'error') return 'error';
		if (side.source === 'not_found') return 'missing';
		if (side.ingestState === 'discovered') return 'discovered';
		if (!side.hasRollupMetrics) return 'missing';
		return 'ready';
	}

	function formatMetric(side: CompareSideLoad | null, key: (typeof metricRows)[number]['key']): string {
		if (!side || sideStatus(side) !== 'ready') return '—';
		const value = side.totals[key];
		return value.toLocaleString();
	}

	const platformTitle = $derived(platformLabel(data.platform === 'youtube' ? 'youtube' : data.platform === 'kick' ? 'kick' : 'twitch'));
	const hasBothSlugs = $derived(Boolean(data.a && data.b));
</script>

<svelte:head>
	<title>Compare streamers · OmniCharts</title>
</svelte:head>

<nav class="text-xs text-[var(--color-oc-text-faint)]">
	<a href={routeWithPlatform('/channels', data.platform === 'kick' ? 'kick' : data.platform === 'youtube' ? 'youtube' : 'twitch')} class="hover:text-[var(--color-oc-accent)]">Channels</a>
	<span class="mx-1">/</span>
	<span class="text-[var(--color-oc-text-muted)]">Compare</span>
</nav>

<header class="mt-2">
	<h1 class="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-oc-text)] sm:text-3xl">
		Compare streamers
	</h1>
	<p class="mt-1 text-sm text-[var(--color-oc-text-muted)]">
		Side-by-side rollup metrics for two channels on {platformTitle}. Rollup-backed only — no live sample scans.
	</p>
</header>

<form class="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onsubmit={submitCompare}>
	<label class="block text-sm">
		<span class="text-xs font-medium uppercase tracking-wider text-[var(--color-oc-text-faint)]">Channel A</span>
		<input
			name="a"
			bind:value={slugA}
			placeholder="slug or handle"
			class="mt-1 w-full rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] px-3 py-2 text-sm text-[var(--color-oc-text)]"
		/>
	</label>
	<label class="block text-sm">
		<span class="text-xs font-medium uppercase tracking-wider text-[var(--color-oc-text-faint)]">Channel B</span>
		<input
			name="b"
			bind:value={slugB}
			placeholder="slug or handle"
			class="mt-1 w-full rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] px-3 py-2 text-sm text-[var(--color-oc-text)]"
		/>
	</label>
	<button
		type="submit"
		class="rounded-lg bg-[var(--color-oc-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-oc-bg)] hover:opacity-90"
	>
		Compare
	</button>
</form>

<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
	<div
		class="inline-flex rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] p-0.5"
		role="group"
		aria-label="Time period"
	>
		{#each comparePeriods as period (period)}
			<a
				href={comparePeriodHref(period)}
				class={cn(
					'rounded-md px-3 py-1 text-xs font-medium transition-colors',
					data.period === period
						? 'bg-[var(--color-oc-bg-card)] text-[var(--color-oc-text)] shadow-sm'
						: 'text-[var(--color-oc-text-muted)] hover:text-[var(--color-oc-text)]'
				)}
				aria-current={data.period === period ? 'page' : undefined}
			>
				{periodLabels[period]}
			</a>
		{/each}
	</div>
	{#if data.periodNote}
		<p class="text-xs text-[var(--color-oc-text-faint)]">{data.periodNote}</p>
	{/if}
</div>

{#if !hasBothSlugs}
	<p class="mt-8 text-sm text-[var(--color-oc-text-muted)]">
		Enter two channel slugs to compare {data.period} rollup metrics, or use
		<a href={routeWithPlatform('/search', data.platform === 'kick' ? 'kick' : data.platform === 'youtube' ? 'youtube' : 'twitch')} class="text-[var(--color-oc-accent)] hover:underline">search</a>
		to find channels first.
	</p>
{:else}
	<div class="mt-8 grid gap-4 lg:grid-cols-2">
		{#each [{ side: data.a, label: 'A' }, { side: data.b, label: 'B' }] as entry (entry.label)}
			{@const side = entry.side}
			<section
				class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5"
				aria-label="Channel {entry.label}"
			>
				{#if side}
					<header class="flex items-center gap-3">
						{#if side.avatarUrl}
							<AvatarImage src={side.avatarUrl} alt="" size={48} rounded="full" />
						{:else}
							<div
								class="flex size-12 items-center justify-center rounded-full border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] text-sm font-semibold text-[var(--color-oc-text-muted)]"
							>
								{side.displayName.slice(0, 1)}
							</div>
						{/if}
						<div>
							<p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-oc-accent)]">
								Channel {entry.label}
							</p>
							<h2 class="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-oc-text)]">
								{#if side.source === 'live' && side.ingestState !== 'discovered'}
									<a
										href="/channels/{side.slugParam}?platform={side.platform}&period={data.period}"
										class="hover:text-[var(--color-oc-accent)]"
									>
										{side.displayName}
									</a>
								{:else}
									{side.displayName}
								{/if}
							</h2>
							<p class="text-xs text-[var(--color-oc-text-faint)]">{ingestStateLabel(side.ingestState)}</p>
						</div>
					</header>

					{#if sideStatus(side) === 'error'}
						<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
							Rankings service unavailable. Start local ingest with <code class="font-mono text-xs">bun run dev:ingest</code>, then refresh.
						</p>
					{:else if sideStatus(side) === 'missing'}
						<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
							{#if side.source === 'not_found'}
								Channel not found on {platformTitle} — check the slug or try
								<a href={routeWithPlatform('/search', data.platform === 'kick' ? 'kick' : data.platform === 'youtube' ? 'youtube' : 'twitch')} class="text-[var(--color-oc-accent)] hover:underline">search</a>.
							{:else}
								No rollup metrics yet for the selected {data.period} window.
							{/if}
						</p>
					{:else if sideStatus(side) === 'discovered'}
						<p class="mt-4 text-sm text-[var(--color-oc-text-muted)]">
							Found on {platformTitle}, but ingest has not promoted this channel to tracked sampling yet.
						</p>
					{:else}
						<ul class="mt-4 space-y-3">
							{#each metricRows as row (row.key)}
								<li class="flex items-baseline justify-between gap-4 border-b border-[var(--color-oc-border-subtle)] pb-2 last:border-0">
									<span class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">{row.label}</span>
									<span class="font-mono text-lg font-semibold text-[var(--color-oc-text)]">
										{formatMetric(side, row.key)}
									</span>
								</li>
							{/each}
						</ul>
						{#if side.daily.length < 2}
							<p class="mt-4 text-xs text-[var(--color-oc-text-faint)]">
								Only {side.daily.length} daily rollup day{side.daily.length === 1 ? '' : 's'} in period — totals may be partial.
							</p>
						{/if}
					{/if}
				{/if}
			</section>
		{/each}
	</div>

	<section
		class="mt-8 overflow-x-auto rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)]"
		aria-label="Metric comparison table"
	>
		<table class="min-w-full text-sm">
			<caption class="sr-only">Side-by-side channel metrics for {data.period}</caption>
			<thead>
				<tr class="border-b border-[var(--color-oc-border)] text-left text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">
					<th scope="col" class="px-4 py-3">Metric</th>
					<th scope="col" class="px-4 py-3">{data.a?.displayName ?? 'Channel A'}</th>
					<th scope="col" class="px-4 py-3">{data.b?.displayName ?? 'Channel B'}</th>
				</tr>
			</thead>
			<tbody>
				{#each metricRows as row (row.key)}
					<tr class="border-b border-[var(--color-oc-border-subtle)] last:border-0">
						<th scope="row" class="px-4 py-3 font-medium text-[var(--color-oc-text-muted)]">{row.label}</th>
						<td class="px-4 py-3 font-mono text-[var(--color-oc-text)]">{formatMetric(data.a, row.key)}</td>
						<td class="px-4 py-3 font-mono text-[var(--color-oc-text)]">{formatMetric(data.b, row.key)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<p class="mt-6 text-sm text-[var(--color-oc-text-muted)]">
	Metrics from ingest rollups for the selected period.
	<a href="/methodology" class="text-[var(--color-oc-accent)] hover:underline">How we measure</a>
</p>
