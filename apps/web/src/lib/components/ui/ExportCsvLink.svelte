<script lang="ts">
	interface Props {
		href: string;
		label?: string;
	}

	let { href, label = 'Export CSV' }: Props = $props();
</script>

<a
	{href}
	download
	class="inline-flex items-center gap-1 rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-oc-text-muted)] hover:border-[var(--color-oc-accent)] hover:text-[var(--color-oc-accent)]"
>
	{label}
</a>
