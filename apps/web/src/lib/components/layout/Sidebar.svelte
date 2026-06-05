<script lang="ts">
	import { page } from '$app/stores';
	import Logo from '$lib/components/brand/Logo.svelte';
	import { cn } from '$lib/utils/cn';

	const nav = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/overview', label: 'Overview', icon: 'overview' },
		{ href: '/channels', label: 'Channels', icon: 'channels' },
		{ href: '/games', label: 'Games', icon: 'games' },
		{ href: '/methodology', label: 'Methodology', icon: 'methodology' }
	] as const;

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<aside
	class="flex w-60 shrink-0 flex-col border-r border-[var(--color-oc-border-subtle)] bg-[var(--color-oc-bg-elevated)]"
>
	<div class="flex h-16 items-center border-b border-[var(--color-oc-border-subtle)] px-4">
		<Logo />
	</div>

	<nav class="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
		{#each nav as item (item.href)}
			<a
				href={item.href}
				class={cn(
					'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
					isActive(item.href, $page.url.pathname)
						? 'bg-[color-mix(in_oklab,var(--color-oc-accent)_14%,transparent)] text-[var(--color-oc-accent)]'
						: 'text-[var(--color-oc-text-muted)] hover:bg-[var(--color-oc-bg-hover)] hover:text-[var(--color-oc-text)]'
				)}
			>
				<span class="size-1.5 rounded-full bg-current opacity-60" aria-hidden="true"></span>
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="border-t border-[var(--color-oc-border-subtle)] p-4">
		<p class="text-xs leading-relaxed text-[var(--color-oc-text-faint)]">
			Open analytics · Official APIs only
		</p>
		<a
			href="/methodology"
			class="mt-2 inline-block text-xs font-medium text-[var(--color-oc-accent)] hover:underline"
		>
			How we measure →
		</a>
	</div>
</aside>
