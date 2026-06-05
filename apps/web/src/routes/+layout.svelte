<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import favicon from '$lib/assets/favicon.svg';

	const fontsUrl =
		'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Sora:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap';

	const { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="preload" as="style" href={fontsUrl} />
	<link
		rel="stylesheet"
		href={fontsUrl}
		media="print"
		onload={(e) => {
			const link = e.currentTarget;
			if (link instanceof HTMLLinkElement) link.media = 'all';
		}}
	/>
	<noscript><link rel="stylesheet" href={fontsUrl} /></noscript>
	<title>OmniCharts</title>
	<meta
		name="description"
		content="Cross-platform live streaming stats for Twitch, Kick, and YouTube. Open analytics built on official APIs."
	/>
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>

<style>
	@import '../app.css';
</style>
