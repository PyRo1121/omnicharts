<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	const { children }: Props = $props();
</script>

<header
	class="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-[var(--color-oc-border-subtle)] bg-[color-mix(in_oklab,var(--color-oc-bg)_92%,transparent)] px-4 backdrop-blur-md sm:px-6"
>
	<div class="flex min-w-0 flex-1 items-center gap-4">
		{@render children?.()}
	</div>
	<a
		href="/methodology"
		class="hidden rounded-lg border border-[var(--color-oc-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-oc-text-muted)] hover:bg-[var(--color-oc-bg-hover)] hover:text-[var(--color-oc-text)] sm:inline-flex"
	>
		How we measure
	</a>
</header>
