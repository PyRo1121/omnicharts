<script lang="ts">
	import Logo from '$lib/components/brand/Logo.svelte';

	let { error, status }: { error: App.Error; status: number } = $props();

	const is404 = $derived(status === 404);
	const loaderMessage = $derived(
		typeof error?.message === 'string' && error.message.trim().length > 0
			? error.message.trim()
			: null
	);
	const title = $derived(
		is404 ? (loaderMessage ? 'Not found' : 'Page not found') : 'Something went wrong'
	);
	const message = $derived(
		is404
			? (loaderMessage ??
				'That route is not in OmniCharts yet — check the URL or head back home.')
			: (loaderMessage ?? 'An unexpected error occurred.')
	);
</script>

<svelte:head>
	<title>{title} · OmniCharts</title>
</svelte:head>

<div class="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
	<Logo class="justify-center" />
	<p class="mt-8 font-mono text-5xl font-semibold tabular-nums text-[var(--color-oc-text-faint)]">
		{status}
	</p>
	<h1
		class="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-oc-text)]"
	>
		{title}
	</h1>
	<p class="mt-3 max-w-md text-sm leading-relaxed text-[var(--color-oc-text-muted)]">{message}</p>
	<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
		<a
			href="/"
			class="rounded-lg bg-[var(--color-oc-accent)] px-4 py-2 text-sm font-medium text-[var(--color-oc-bg)] hover:opacity-90"
		>
			Back to home
		</a>
		<a
			href="/search"
			class="rounded-lg border border-[var(--color-oc-border)] px-4 py-2 text-sm font-medium text-[var(--color-oc-text)] hover:bg-[var(--color-oc-bg-elevated)]"
		>
			Search channels
		</a>
	</div>
</div>
