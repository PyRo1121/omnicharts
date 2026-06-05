<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PlatformId } from '$lib/mock/home';
	import { debounce } from '$lib/utils/debounce';

	interface Trending {
		slug: string;
		name: string;
		platform: Exclude<PlatformId, 'all'>;
	}

	type SearchHit = {
		id: string;
		slug: string;
		display_name: string;
		platform_id: string;
	};

	interface Props {
		trending: Trending[];
		platform?: Exclude<PlatformId, 'all'>;
		initialQuery?: string;
	}

	let { trending, platform = 'twitch', initialQuery = '' }: Props = $props();

	let query = $state('');
	let hits = $state<SearchHit[]>([]);
	let searching = $state(false);
	let searchError = $state(false);
	let activeIndex = $state(-1);

	const listboxId = 'channel-search-listbox';
	const showListbox = $derived(query.length >= 2);

	$effect.pre(() => {
		query = initialQuery;
	});

	$effect(() => {
		if (hits.length === 0) {
			activeIndex = -1;
		} else if (activeIndex >= hits.length) {
			activeIndex = hits.length - 1;
		}
	});

	const runSearch = debounce(async (q: string, platformId: typeof platform) => {
		if (q.trim().length < 2) {
			hits = [];
			searchError = false;
			searching = false;
			return;
		}
		searching = true;
		searchError = false;
		try {
			const params = new URLSearchParams({ q, platform: platformId, limit: '10' });
			const res = await fetch(`/api/v1/search/channels?${params}`);
			if (!res.ok) throw new Error(String(res.status));
			const body = (await res.json()) as { results: SearchHit[] };
			hits = body.results ?? [];
			activeIndex = hits.length > 0 ? 0 : -1;
		} catch {
			hits = [];
			searchError = true;
			activeIndex = -1;
		} finally {
			searching = false;
		}
	}, 200);

	$effect(() => {
		runSearch(query, platform);
	});

	function navigateToHit(hit: SearchHit) {
		goto(`/channels/${hit.slug}?platform=${hit.platform_id}`);
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (showListbox && hits.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				activeIndex = Math.min(activeIndex + 1, hits.length - 1);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				activeIndex = Math.max(activeIndex - 1, 0);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				query = '';
				hits = [];
				activeIndex = -1;
				return;
			}
		}

		if (e.key !== 'Enter') return;
		const q = query.trim();
		if (q.length < 2) return;
		e.preventDefault();

		if (showListbox && hits.length > 0 && activeIndex >= 0) {
			navigateToHit(hits[activeIndex]);
			return;
		}

		const exact = hits.find((h) => h.slug.toLowerCase() === q.toLowerCase());
		if (exact) {
			navigateToHit(exact);
			return;
		}
		if (hits.length === 1) {
			navigateToHit(hits[0]);
			return;
		}
		goto(`/search?q=${encodeURIComponent(q)}&platform=${platform}`);
	}
</script>

<div class="relative w-full max-w-xl">
	<label class="sr-only" for="channel-search">Search channels</label>
	<div
		class="flex items-center gap-2 rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] px-4 py-2.5 focus-within:border-[var(--color-oc-accent)] focus-within:ring-2 focus-within:ring-[color-mix(in_oklab,var(--color-oc-accent)_25%,transparent)]"
	>
		<svg class="size-5 shrink-0 text-[var(--color-oc-text-faint)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
				stroke="currentColor"
				stroke-width="1.75"
			/>
			<path d="M16 16l5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
		</svg>
		<input
			id="channel-search"
			type="search"
			role="combobox"
			aria-haspopup="listbox"
			aria-expanded={showListbox && (searching || searchError || hits.length > 0)}
			aria-controls={showListbox ? listboxId : undefined}
			aria-autocomplete="list"
			aria-activedescendant={activeIndex >= 0 && showListbox && hits.length > 0
				? `${listboxId}-option-${activeIndex}`
				: undefined}
			placeholder="Search streamers, games, categories…"
			class="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-oc-text)] placeholder:text-[var(--color-oc-text-faint)] outline-none"
			bind:value={query}
			autocomplete="off"
			onkeydown={onSearchKeydown}
		/>
		<kbd
			class="hidden rounded border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-oc-text-faint)] sm:inline"
		>
			/
		</kbd>
	</div>

	{#if showListbox}
		<ul
			id={listboxId}
			class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] py-1 shadow-lg"
			role="listbox"
			aria-label="Channel search results"
		>
			{#if searching}
				<li class="px-4 py-2 text-xs text-[var(--color-oc-text-muted)]" role="presentation">Searching…</li>
			{:else if searchError}
				<li class="px-4 py-2 text-xs text-[var(--color-oc-text-muted)]" role="presentation">
					Search unavailable — is ingest running?
				</li>
			{:else if hits.length === 0}
				<li class="px-4 py-2 text-xs text-[var(--color-oc-text-muted)]" role="presentation">No channels found</li>
			{:else}
				{#each hits as hit, index (hit.id)}
					<li
						id="{listboxId}-option-{index}"
						role="option"
						aria-selected={index === activeIndex}
					>
						<a
							href="/channels/{hit.slug}?platform={hit.platform_id}"
							class="block px-4 py-2 text-sm text-[var(--color-oc-text)] hover:bg-[var(--color-oc-bg-elevated)] {index === activeIndex
								? 'bg-[var(--color-oc-bg-elevated)]'
								: ''}"
						>
							{hit.display_name}
							<span class="ml-2 text-xs text-[var(--color-oc-text-faint)]">@{hit.slug}</span>
						</a>
					</li>
				{/each}
			{/if}
		</ul>
	{:else if trending.length > 0}
		<ul class="mt-2 flex flex-wrap gap-2" aria-label="Trending">
			{#each trending as ch (ch.slug + ch.platform)}
				<li>
					<a
						href="/channels/{ch.slug}?platform={ch.platform}"
						class="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-oc-border-subtle)] bg-[var(--color-oc-bg-elevated)] px-2.5 py-1 text-xs text-[var(--color-oc-text-muted)] hover:border-[var(--color-oc-border)] hover:text-[var(--color-oc-text)]"
					>
						<span class="text-[var(--color-oc-text-faint)]">↗</span>
						{ch.name}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
