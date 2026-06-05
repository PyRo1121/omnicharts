<script lang="ts">
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
	import Footer from './Footer.svelte';
	import Sidebar from './Sidebar.svelte';
	import TopBar from './TopBar.svelte';
	import Logo from '$lib/components/brand/Logo.svelte';
	import { parseUiPlatform, routeWithPlatform } from '$lib/ui/platform.svelte';

	interface Props {
		children: Snippet;
		topbar?: Snippet;
	}

	let { children, topbar }: Props = $props();

	const activePlatform = $derived(parseUiPlatform($page.url.searchParams.get('platform')));
</script>

<div class="flex min-h-dvh bg-[var(--color-oc-bg)]">
	<div class="hidden lg:flex">
		<Sidebar />
	</div>

	<div class="flex min-w-0 flex-1 flex-col">
		<div
			class="flex h-14 items-center justify-between border-b border-[var(--color-oc-border-subtle)] bg-[var(--color-oc-bg-elevated)] px-4 lg:hidden"
		>
			<Logo compact />
			<nav class="flex gap-3 text-xs font-medium text-[var(--color-oc-text-muted)]" aria-label="Mobile">
				<a href={routeWithPlatform('/channels', activePlatform)} class="hover:text-[var(--color-oc-text)]"
					>Channels</a
				>
				<a href={routeWithPlatform('/games', activePlatform)} class="hover:text-[var(--color-oc-text)]"
					>Games</a
				>
			</nav>
		</div>

		<TopBar>
			{#snippet children()}
				{@render topbar?.()}
			{/snippet}
		</TopBar>

		<main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
			{@render children()}
		</main>

		<Footer />
	</div>
</div>
