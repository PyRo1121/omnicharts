<script lang="ts">
	import { cn } from '$lib/utils/cn';

	export type RankingLanguage = { code: string; label: string };

	interface Props {
		languages: readonly RankingLanguage[];
		value: string | null;
		onLanguageChange?: (code: string | null) => void;
	}

	let { languages, value, onLanguageChange }: Props = $props();
</script>

<label class="inline-flex items-center gap-2 text-sm text-[var(--color-oc-text-muted)]">
	<span class="sr-only">Stream language</span>
	<select
		class={cn(
			'rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] px-3 py-1.5 text-sm',
			'text-[var(--color-oc-text)] focus:border-[var(--color-oc-accent)] focus:outline-none'
		)}
		value={value ?? ''}
		onchange={(e) => {
			const next = e.currentTarget.value;
			onLanguageChange?.(next === '' ? null : next);
		}}
		aria-label="Filter by stream language"
	>
		<option value="">All languages</option>
		{#each languages as lang (lang.code)}
			<option value={lang.code}>{lang.label}</option>
		{/each}
	</select>
</label>
