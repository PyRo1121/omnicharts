<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		compact?: boolean;
		class?: string;
	}

	const { compact = false, class: className }: Props = $props();
</script>

<a href="/" aria-label="OmniCharts home" class={cn('group inline-flex items-center gap-2.5', className)}>
	<span
		class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-oc-accent)] to-[var(--color-oc-highlight)] text-sm font-bold text-[var(--color-oc-bg)] shadow-sm"
		aria-hidden="true"
	>
		O
	</span>
	{#if !compact}
		<span class="flex flex-col leading-tight">
			<span class="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight">
				Omni<span class="text-[var(--color-oc-accent)]">Charts</span>
			</span>
			<span class="text-[10px] uppercase tracking-[0.2em] text-[var(--color-oc-text-faint)]">
				Live analytics
			</span>
		</span>
	{/if}
</a>
