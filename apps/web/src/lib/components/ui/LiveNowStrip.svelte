<script lang="ts">
	interface Props {
		count: number;
	}

	const { count }: Props = $props();

	const isEmpty = $derived(count === 0);
</script>

<div
	class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 {isEmpty
		? 'border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)]'
		: 'border-[var(--color-oc-accent)]/30 bg-[color-mix(in_oklab,var(--color-oc-accent)_8%,var(--color-oc-bg-card))]'}"
	role="status"
>
	<p class="text-sm text-[var(--color-oc-text)]">
		{#if isEmpty}
			<span
				class="inline-block size-2 rounded-full bg-[var(--color-oc-text-faint)] align-middle"
				aria-hidden="true"
			></span>
			<span class="ml-2 text-[var(--color-oc-text-muted)]">No tracked channels live right now</span>
		{:else}
			<span
				class="inline-block size-2 rounded-full bg-[var(--color-oc-highlight)] align-middle"
				aria-hidden="true"
			></span>
			<strong class="ml-2 font-mono tabular-nums">{count.toLocaleString()}</strong>
			<span class="text-[var(--color-oc-text-muted)]"> channels live now</span>
		{/if}
	</p>
	<a href="/channels" class="text-xs font-medium text-[var(--color-oc-accent)] hover:underline">
		Browse channels →
	</a>
</div>
