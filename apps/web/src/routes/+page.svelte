<script lang="ts">
	import { goto } from '$app/navigation';
	import PlatformFilter from '$lib/components/ui/PlatformFilter.svelte';
	import PeriodSelector from '$lib/components/ui/PeriodSelector.svelte';
	import SearchChannels from '$lib/components/ui/SearchChannels.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import LeaderboardTable from '$lib/components/ui/LeaderboardTable.svelte';
	import LiveNowStrip from '$lib/components/ui/LiveNowStrip.svelte';
	import DonationBanner from '$lib/components/ui/DonationBanner.svelte';
	import {
		uiPeriods,
		platforms,
		searchPlatformId,
		platformQueryParam,
		type Period,
		type PlatformId
	} from '$lib/mock/home';

	let { data } = $props();

	const isDemo = $derived(
		data.channelRankings.source === 'mock' || data.gameRankings.source === 'mock'
	);

	const liveRollupPlatformName = $derived(
		platforms.find((p) => p.id === searchPlatformId(data.platform))?.label ?? 'Twitch'
	);

	const channelRows = $derived(
		data.platformUnsupported
			? []
			: data.channelRankings.rows.map((c) => ({
					rank: c.rank,
					href: `/channels/${c.slug}?platform=${c.platform}`,
					primary: c.displayName,
					imageUrl: c.avatarUrl,
					imageAlt: c.displayName,
					metric: c.metric,
					metricLabel: c.metricLabel,
					platform: c.platform
				}))
	);

	const gameRows = $derived(
		data.platformUnsupported
			? []
			: data.gameRankings.rows.map((g) => ({
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

	function homeQuery(platform: PlatformId, period: Period): string {
		const q = new URLSearchParams();
		q.set('period', period);
		if (platform === 'kick' || platform === 'youtube' || platform === 'all') {
			q.set('platform', platform);
		}
		return `/?${q}`;
	}

	function platformHref(id: PlatformId): string {
		return homeQuery(id, data.period);
	}

	function onPeriodChange(p: Period) {
		goto(homeQuery(data.platform, p), { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>Live Streaming Stats · OmniCharts</title>
</svelte:head>

<section class="relative overflow-hidden rounded-2xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-6 sm:p-8">
	<div class="oc-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden="true"></div>

	<div class="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-oc-accent)]">
				Open live streaming intelligence
			</p>
			<h1
				class="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold leading-[1.1] tracking-tight text-[var(--color-oc-text)] sm:text-4xl lg:text-[2.75rem]"
			>
				Every platform.<br />
				<span class="text-[var(--color-oc-text-muted)]">One</span>
				<span class="bg-gradient-to-r from-[var(--color-oc-accent)] to-[var(--color-oc-highlight)] bg-clip-text text-transparent">
					dashboard.
				</span>
			</h1>
			<p class="mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-oc-text-muted)] sm:text-base">
				Hours watched, peaks, and category trends — sampled from official APIs. Built for streamers,
				agencies, and curious viewers. Twitch rankings load from ingest when rollups exist.
			</p>

			<div class="mt-6 flex flex-col gap-4">
				<PlatformFilter {platforms} value={data.platform} hrefFor={platformHref} />
				<SearchChannels trending={data.trending} platform={searchPlatformId(data.platform)} />
			</div>
		</div>

		<ul class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
			{#if !data.platformUnsupported}
				{#each data.overview.stats as stat (stat.label)}
					<li
						class="rounded-xl border border-[var(--color-oc-border-subtle)] bg-[var(--color-oc-bg-elevated)] px-4 py-3 oc-glow-accent"
					>
						<p class="text-[10px] uppercase tracking-wider text-[var(--color-oc-text-faint)]">
							{stat.label}
							{#if stat.source === 'mock'}
								<span class="ml-1 rounded bg-[var(--color-oc-bg-card)] px-1 py-0.5 text-[9px] font-semibold uppercase text-[var(--color-oc-text-muted)]">
									demo
								</span>
							{/if}
						</p>
						<p class="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--color-oc-text)]">
							{stat.value}
						</p>
						<p class="mt-0.5 text-xs text-[var(--color-oc-text-muted)]">{stat.hint}</p>
					</li>
				{/each}
			{/if}
		</ul>
	</div>
</section>

{#if data.overview.channelsLive != null && (data.platform === 'twitch' || data.platform === 'all')}
	<LiveNowStrip count={data.overview.channelsLive} />
{/if}

<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
	<PeriodSelector periods={uiPeriods} value={data.period} onchange={onPeriodChange} />
	{#if data.periodNote}
		<p class="text-xs text-[var(--color-oc-text-faint)]">{data.periodNote}</p>
	{/if}
	<p class="text-xs text-[var(--color-oc-text-faint)]">
		{#if isDemo}
			<span
				class="rounded border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] px-1.5 py-0.5 font-medium uppercase tracking-wide text-[var(--color-oc-text-muted)]"
			>
				demo
			</span>
			<span class="ml-1">design preview — add <code class="text-[10px]">?demo=1</code> or start ingest</span>
		{:else if data.channelRankings.source === 'unavailable' || data.gameRankings.source === 'unavailable'}
			Ingest unavailable — start <code class="text-[10px]">bun run dev:ingest</code> and run checkpoint for rollups
		{:else if data.channelRankings.source === 'live' || data.gameRankings.source === 'live'}
			Live {liveRollupPlatformName} rollups · {data.period}
		{/if}
	</p>
</div>

{#if data.platformUnsupported}
	<p
		class="mt-4 rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] px-4 py-3 text-sm text-[var(--color-oc-text-muted)]"
	>
		{data.platform === 'kick' ? 'Kick' : 'YouTube'} rankings ship in Phase 3. Switch to Twitch for live
		leaderboards.
	</p>
{/if}

<div class="mt-8 grid gap-8 xl:grid-cols-2">
	<section>
		<SectionHeader title="Top streamers" subtitle="Ranked by hours watched">
			{#snippet actions()}
				<a
					href="/channels?period={data.period}{platformQueryParam(data.platform)}"
					class="text-xs font-medium text-[var(--color-oc-accent)] hover:underline"
				>
				>
					View all →
				</a>
			{/snippet}
		</SectionHeader>
		<div class="mt-4">
			<LeaderboardTable
				rows={channelRows}
				metricHeader="Hours watched"
				emptyMessage={data.platformUnsupported
					? `${data.platform === 'kick' ? 'Kick' : 'YouTube'} rankings ship in Phase 3. Switch to Twitch for live leaderboards.`
					: channelRows.length === 0
						? data.channelRankings.source === 'unavailable'
							? 'Channel rankings unavailable — ingest not reachable.'
							: 'No channel rollups yet for this period.'
						: null}
			/>
		</div>
	</section>

	<section>
		<SectionHeader title="Top categories" subtitle="Ranked by average viewers">
			{#snippet actions()}
				<a
					href="/games?period={data.period}{platformQueryParam(data.platform)}"
					class="text-xs font-medium text-[var(--color-oc-accent)] hover:underline"
				>
				>
					View all →
				</a>
			{/snippet}
		</SectionHeader>
		<div class="mt-4">
			<LeaderboardTable
				rows={gameRows}
				metricHeader="Avg viewers"
				emptyMessage={data.platformUnsupported
					? `${data.platform === 'kick' ? 'Kick' : 'YouTube'} rankings ship in Phase 3. Switch to Twitch for live leaderboards.`
					: gameRows.length === 0
						? data.gameRankings.source === 'unavailable'
							? 'Game rankings unavailable — ingest not reachable.'
							: 'No game rollups yet for this period.'
						: null}
			/>
		</div>
	</section>
</div>

<DonationBanner />

<section class="mt-10 rounded-xl border border-dashed border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] p-6 text-center">
	<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
		Connect your channel (coming soon)
	</h2>
	<p class="mx-auto mt-2 max-w-lg text-sm text-[var(--color-oc-text-muted)]">
		Opt-in bot for chat and viewer insights — global stream stats stay API-driven, no clone of
		third-party scrapers.
	</p>
</section>
