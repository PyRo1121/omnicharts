<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { PlatformId } from '$lib/ui/platform.svelte';

	interface Props {
		platforms: { id: PlatformId; label: string }[];
		value: PlatformId;
		hrefFor: (id: PlatformId) => string;
	}

	let { platforms, value, hrefFor }: Props = $props();

	const dotClass: Record<PlatformId, string> = {
		all: 'bg-[var(--color-oc-accent)]',
		twitch: 'bg-[var(--color-oc-twitch)]',
		kick: 'bg-[var(--color-oc-kick)]',
		youtube: 'bg-[var(--color-oc-youtube)]'
	};
</script>

<nav class="flex flex-wrap gap-2" aria-label="Platform">
	{#each platforms as p (p.id)}
		<a
			href={hrefFor(p.id)}
			aria-current={value === p.id ? 'page' : undefined}
			class={cn(
				'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
				value === p.id
					? 'border-[var(--color-oc-accent)] bg-[color-mix(in_oklab,var(--color-oc-accent)_12%,transparent)] text-[var(--color-oc-text)]'
					: 'border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] text-[var(--color-oc-text-muted)] hover:border-[var(--color-oc-border)] hover:bg-[var(--color-oc-bg-hover)] hover:text-[var(--color-oc-text)]'
			)}
		>
			<span class={cn('size-2 rounded-full', dotClass[p.id])} aria-hidden="true"></span>
			{p.label}
		</a>
	{/each}
</nav>
