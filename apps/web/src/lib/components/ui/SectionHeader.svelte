<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		actions?: Snippet;
	}

	let { title, subtitle, actions }: Props = $props();
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<h2 class="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[var(--color-oc-text)]">
			{title}
		</h2>
		{#if subtitle}
			<p class="mt-0.5 text-sm text-[var(--color-oc-text-muted)]">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</div>
