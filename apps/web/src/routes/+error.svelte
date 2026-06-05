<script lang="ts">
	import Logo from '$lib/components/brand/Logo.svelte';

	type ChannelSuggestion = {
		slug: string;
		platform: string;
		displayName: string;
	};

	type AppError = {
		message?: string;
		suggestions?: ChannelSuggestion[];
	};

	let { error, status }: { error: App.Error; status: number } = $props();

	const appError = $derived((error ?? {}) as AppError);

	const is404 = $derived(status === 404);
	const loaderMessage = $derived(
		typeof appError.message === 'string' && appError.message.trim().length > 0
			? appError.message.trim()
			: null
	);
	const suggestions = $derived(appError.suggestions ?? []);
	const title = $derived(
		is404 ? (loaderMessage ? 'Not found' : 'Page not found') : 'Something went wrong'
	);
	const message = $derived(
		is404
			? (loaderMessage ??
				'That route is not in OmniCharts yet — check the URL or head back home.')
			: (loaderMessage ?? 'An unexpected error occurred.')
	);

	const platformLabel: Record<string, string> = {
		twitch: 'Twitch',
		kick: 'Kick',
		youtube: 'YouTube'
	};
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

	{#if suggestions.length > 0}
		<div class="mt-6 w-full max-w-md text-left">
			<p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-oc-text-faint)]">
				Did you mean
			</p>
			<ul class="mt-2 space-y-2">
				{#each suggestions as row (row.platform + row.slug)}
					<li>
						<a
							href="/channels/{row.slug}?platform={row.platform}"
							class="flex items-center justify-between rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] px-4 py-3 text-sm hover:bg-[var(--color-oc-bg-elevated)]"
						>
							<span class="font-medium text-[var(--color-oc-text)]">{row.displayName}</span>
							<span class="text-xs text-[var(--color-oc-text-faint)]">
								{platformLabel[row.platform] ?? row.platform}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

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
