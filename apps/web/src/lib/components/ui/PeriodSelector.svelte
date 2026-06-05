<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Period } from '$lib/ui/platform.svelte';

	interface Props {
		periods: readonly Period[];
		value: Period;
		onPeriodChange?: (p: Period) => void;
	}

	let { periods, value, onPeriodChange }: Props = $props();

	const labels: Record<Period, string> = {
		'24h': '24 hours',
		'7d': '7 days',
		'30d': '30 days',
		'90d': '90 days'
	};
</script>

<div
	class="inline-flex rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] p-0.5"
	role="group"
	aria-label="Time period"
>
	{#each periods as p (p)}
		<button
			type="button"
			class={cn(
				'rounded-md px-3 py-1 text-xs font-medium transition-colors',
				value === p
					? 'bg-[var(--color-oc-bg-card)] text-[var(--color-oc-text)] shadow-sm'
					: 'text-[var(--color-oc-text-muted)] hover:text-[var(--color-oc-text)]'
			)}
			aria-pressed={value === p}
			onclick={() => onPeriodChange?.(p)}
		>
			{labels[p]}
		</button>
	{/each}
</div>
