<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Period } from '$lib/mock/home';

	interface Props {
		periods: readonly Period[];
		value: Period;
		onchange?: (p: Period) => void;
	}

	let { periods, value, onchange }: Props = $props();

	const labels: Record<Period, string> = {
		'24h': '24 hours',
		'7d': '7 days',
		'30d': '30 days',
		'90d': '90 days'
	};
</script>

<div class="inline-flex rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] p-0.5">
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
			onclick={() => onchange?.(p)}
		>
			{labels[p]}
		</button>
	{/each}
</div>
