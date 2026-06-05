<script lang="ts">
	import AvatarImage from '$lib/components/ui/AvatarImage.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import SearchChannels from '$lib/components/ui/SearchChannels.svelte';
	import PlatformFilter from '$lib/components/ui/PlatformFilter.svelte';
	import {
		platforms,
		routeWithPlatform,
		searchPageSubtitle,
		searchPlatformId,
		type UiPlatformFilter
	} from '$lib/ui/platform.svelte';

	const { data } = $props();

	const platformLabel: Record<string, string> = {
		twitch: 'Twitch',
		kick: 'Kick',
		youtube: 'YouTube'
	};

	function platformHref(id: UiPlatformFilter): string {
		const extra: Record<string, string> = {};
		if (data.q.trim()) extra.q = data.q.trim();
		return routeWithPlatform('/search', id, extra);
	}
</script>

<svelte:head>
	<title>Search channels · OmniCharts</title>
</svelte:head>

<SectionHeader title="Search channels" subtitle={searchPageSubtitle(data.platform)} />

<div class="mt-4">
	<PlatformFilter {platforms} value={data.platform} hrefFor={platformHref} />
</div>

<div class="mt-6 max-w-xl">
	{#key `${data.q}-${data.platform}`}
		<SearchChannels
			trending={data.trending}
			platform={searchPlatformId(
				data.platform === 'kick' || data.platform === 'youtube' || data.platform === 'twitch'
					? data.platform
					: ('all' as const)
			)}
			initialQuery={data.q}
		/>
	{/key}
</div>

{#if data.q.trim().length < 2}
	<p class="mt-8 text-sm text-[var(--color-oc-text-muted)]">
		Type at least two characters, or pick a trending channel below.
	</p>
{:else if data.error}
	<p class="mt-8 text-sm text-[var(--color-oc-text-muted)]">
		Search unavailable — is ingest running?
	</p>
{:else if data.results.length === 0}
	<p class="mt-8 text-sm text-[var(--color-oc-text-muted)]">
		No channels found for “{data.q}”.
	</p>
{:else}
	<div class="mt-8 overflow-hidden rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)]">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-[var(--color-oc-border-subtle)] text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">
					<th scope="col" class="px-4 py-3 font-medium">Channel</th>
					<th scope="col" class="hidden px-4 py-3 font-medium sm:table-cell">Platform</th>
					<th scope="col" class="px-4 py-3 text-right font-medium">7d hours watched</th>
				</tr>
			</thead>
			<tbody>
				{#each data.results as row (row.id)}
					<tr class="border-b border-[var(--color-oc-border-subtle)] last:border-0 hover:bg-[var(--color-oc-bg-elevated)]">
						<td class="px-4 py-3">
							<a href="/channels/{row.slug}?platform={row.platform}" class="flex items-center gap-3 min-w-0">
								{#if row.avatarUrl}
									<AvatarImage src={row.avatarUrl} alt="" size={40} rounded="full" />
								{:else}
									<div
										class="flex size-10 items-center justify-center rounded-full border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] text-sm font-semibold text-[var(--color-oc-text-muted)]"
									>
										{row.displayName.slice(0, 1)}
									</div>
								{/if}
								<span class="min-w-0">
									<span class="block truncate font-medium text-[var(--color-oc-text)]">{row.displayName}</span>
									<span class="block truncate text-xs text-[var(--color-oc-text-faint)]">@{row.slug}</span>
								</span>
							</a>
						</td>
						<td class="hidden px-4 py-3 sm:table-cell">
							{#if platformLabel[row.platform]}
								<span
									class="inline-flex rounded-full border border-[var(--color-oc-border-subtle)] bg-[var(--color-oc-bg-elevated)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-oc-text-muted)]"
								>
									{platformLabel[row.platform]}
								</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right font-mono text-sm tabular-nums text-[var(--color-oc-text)]">
							{row.hoursWatched7d ?? '—'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
