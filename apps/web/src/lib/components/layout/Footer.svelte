<script lang="ts">
	import { page } from '$app/stores';
	import { parseUiPlatform, routeWithPlatform } from '$lib/ui/platform.svelte';

	const activePlatform = $derived(parseUiPlatform($page.url.searchParams.get('platform')));
</script>

<footer class="border-t border-[var(--color-oc-border-subtle)] bg-[var(--color-oc-bg-elevated)] px-4 py-8 sm:px-6 lg:px-8">
	<div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<p class="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-oc-text)]">
				OmniCharts
			</p>
			<p class="mt-1 max-w-md text-xs text-[var(--color-oc-text-faint)]">
				Independent live streaming analytics. Not affiliated with Twitch Interactive, Kick Streaming,
				Google/YouTube, Streams Charts, or Esports Charts. Platform names and logos are trademarks of
				their owners.
			</p>
		</div>
		<ul class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--color-oc-text-muted)]">
			<li><a href="/methodology" class="hover:text-[var(--color-oc-accent)]">Methodology</a></li>
			<li><a href="/privacy" class="hover:text-[var(--color-oc-accent)]">Privacy</a></li>
			<li><a href="/terms" class="hover:text-[var(--color-oc-accent)]">Terms</a></li>
			<li><a href="/support" class="hover:text-[var(--color-oc-accent)]">Support</a></li>
			<li>
				<a href={routeWithPlatform('/channels', activePlatform)} class="hover:text-[var(--color-oc-accent)]"
					>Channels</a
				>
			</li>
			<li>
				<a href={routeWithPlatform('/games', activePlatform)} class="hover:text-[var(--color-oc-accent)]">Games</a>
			</li>
		</ul>
	</div>
</footer>
