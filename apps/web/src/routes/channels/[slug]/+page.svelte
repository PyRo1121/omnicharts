<script lang="ts">
	import { goto } from '$app/navigation';
	import AvatarImage from '$lib/components/ui/AvatarImage.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import PeriodSelector from '$lib/components/ui/PeriodSelector.svelte';
	import { ingestStateLabel } from '$lib/ingest-state-label';
	import { uiPeriods, type Period } from '$lib/ui/platform.svelte';

	let { data } = $props();
	const ch = $derived(data.channel);

	const metrics = $derived(() => {
		const base = [
			{ label: 'Hours watched', value: ch.totals.hoursWatched.toLocaleString() },
			{ label: 'Avg viewers', value: ch.totals.averageViewers.toLocaleString() },
			{ label: 'Peak viewers', value: ch.totals.peakViewers.toLocaleString() },
			{ label: 'Airtime (h)', value: ch.totals.airtimeHours.toLocaleString() }
		];
		if (ch.source === 'live' && ch.totals.streamCount > 0) {
			base.push({
				label: 'Streams',
				value: ch.totals.streamCount.toLocaleString()
			});
		}
		if (ch.source === 'live' && ch.totals.followersGain != null) {
			const sign = ch.totals.followersGain >= 0 ? '+' : '';
			base.push({
				label: 'Followers gained',
				value: `${sign}${ch.totals.followersGain.toLocaleString()}`
			});
		}
		return base;
	});

	function onPeriodChange(p: Period) {
		const q = new URLSearchParams();
		q.set('platform', ch.platform);
		q.set('period', p);
		goto(`/channels/${ch.slug}?${q}`, { keepFocus: true, noScroll: true });
	}

	const platformTitle = $derived(
		ch.platform === 'twitch' ? 'Twitch' : ch.platform === 'kick' ? 'Kick' : ch.platform === 'youtube' ? 'YouTube' : ch.platform
	);
</script>

<svelte:head>
	<title>{ch.displayName} {platformTitle} Stats · OmniCharts</title>
</svelte:head>

<nav class="text-xs text-[var(--color-oc-text-faint)]">
	<a href="/channels" class="hover:text-[var(--color-oc-accent)]">Channels</a>
	<span class="mx-1">/</span>
	<span class="text-[var(--color-oc-text-muted)]">{ch.displayName}</span>
</nav>

{#if ch.source === 'error'}
	<SectionHeader
		title={ch.slug}
		subtitle="Rankings service unavailable. Start local ingest with bun run dev:ingest, then refresh."
	/>
{:else if ch.ingestState === 'discovered'}
	<header class="mt-4 flex items-center gap-4">
		{#if ch.avatarUrl}
			<AvatarImage
				src={ch.avatarUrl}
				alt=""
				size={72}
				rounded="full"
				loading="eager"
				fetchpriority="high"
			/>
		{:else}
			<div
				class="flex size-[72px] items-center justify-center rounded-full border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] text-lg font-semibold text-[var(--color-oc-text-muted)]"
			>
				{ch.displayName.slice(0, 1)}
			</div>
		{/if}
		<div>
			<p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-oc-accent)]">
				{ch.platform}
			</p>
			<h1
				class="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-oc-text)] sm:text-3xl"
			>
				{ch.displayName}
			</h1>
		</div>
	</header>
	<SectionHeader
		title="Not tracking yet"
		subtitle="We found {ch.displayName} on {ch.platform}, but ingest has not promoted this channel to tracked sampling yet. Rankings and charts appear after promotion."
	/>
{:else}
	<header class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div class="flex items-center gap-4">
			{#if ch.avatarUrl}
				<AvatarImage
					src={ch.avatarUrl}
					alt=""
					size={72}
					rounded="full"
					loading="eager"
					fetchpriority="high"
				/>
			{:else}
				<div
					class="flex size-[72px] items-center justify-center rounded-full border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] text-lg font-semibold text-[var(--color-oc-text-muted)]"
				>
					{ch.displayName.slice(0, 1)}
				</div>
			{/if}
			<div>
				<p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-oc-accent)]">
					{ch.platform}
				</p>
				<h1
					class="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-oc-text)] sm:text-3xl"
				>
					{ch.displayName}
				</h1>
				{#if ch.trackedSince}
					<p class="mt-1 text-xs text-[var(--color-oc-text-faint)]">
						Tracked since {new Date(ch.trackedSince).toLocaleDateString()}
						{#if ch.language}
							· {ch.language}
						{/if}
					</p>
				{/if}
			</div>
		</div>
		<div class="text-right text-sm text-[var(--color-oc-text-muted)]">
			{#if ch.followerCount != null}
				<p>{ch.followerCount.toLocaleString()} followers</p>
			{/if}
			<p class="text-xs text-[var(--color-oc-text-faint)]">{ingestStateLabel(ch.ingestState)}</p>
		</div>
	</header>

	<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
		<PeriodSelector periods={uiPeriods} value={ch.period} onchange={onPeriodChange} />
		{#if data.periodNote}
			<p class="text-xs text-[var(--color-oc-text-faint)]">{data.periodNote}</p>
		{/if}
	</div>

	<ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each metrics() as m (m.label)}
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
		{#if ch.daily.length >= 2}
			<div class="mt-4 min-h-[200px]">
				{#await import('$lib/components/ui/ViewershipChart.svelte')}
					<p class="text-xs text-[var(--color-oc-text-faint)]" aria-busy="true">Loading chart…</p>
					{:then { default: ViewershipChart }}
						<ViewershipChart daily={ch.daily} />
					{/await}
			</div>
			<p class="mt-3 text-xs text-[var(--color-oc-text-faint)]">
				Daily rollup points for the selected period — each series scaled independently for shape comparison.
			</p>
		{:else}
			<p class="mx-auto mt-3 max-w-md text-center text-xs text-[var(--color-oc-text-muted)]">
				Not enough daily rollup history yet ({ch.daily.length} day{ch.daily.length === 1 ? '' : 's'} in
				period). Check back after ingest has recorded at least two days for this channel.
			</p>
		{/if}
	</section>

	<section
		class="mt-8 rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5 sm:p-6"
		aria-label="Recent streams"
	>
		<h2 class="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-oc-text)]">
			Recent streams
		</h2>
		<p class="mx-auto mt-3 max-w-md text-center text-xs text-[var(--color-oc-text-muted)]">
			Individual stream sessions are not listed yet (Phase 4). Period totals and the chart above come from
			daily rollups for this channel.
		</p>
	</section>

	{#if ch.description}
		<p class="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--color-oc-text-muted)]">
			{ch.description}
		</p>
	{/if}

	<p class="mt-6 text-sm text-[var(--color-oc-text-muted)]">
		Metrics from ingest rollups for the selected period.
		<a href="/methodology" class="text-[var(--color-oc-accent)] hover:underline">How we measure</a>
	</p>
{/if}
