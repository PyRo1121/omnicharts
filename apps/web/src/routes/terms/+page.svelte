<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	<title>Terms of Service — OmniCharts</title>
</svelte:head>

<SectionHeader
	title="Terms of Service"
	subtitle="Draft — not legal advice. Attorney review required before public beta."
/>

<article class="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-[var(--color-oc-text-muted)]">
	<p class="rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] px-4 py-3 text-xs text-[var(--color-oc-text-faint)]">
		Placeholder terms outline. Legal notices:
		<a href="mailto:legal@omnicharts.com" class="text-[var(--color-oc-accent)] hover:underline"
			>legal@omnicharts.com</a
		>
	</p>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Service description
		</h2>
		<p class="mt-2">
			OmniCharts publishes live streaming statistics derived from official platform APIs. Metrics are estimates
			provided “as is” — not investment, contract, or endorsement advice.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			No affiliation
		</h2>
		<p class="mt-2">
			We are not Twitch, Kick, YouTube, Streams Charts, or Esports Charts. Platform trademarks belong to their
			owners.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Acceptable use
		</h2>
		<ul class="mt-2 list-disc space-y-1 pl-5">
			<li>Do not scrape or overload OmniCharts infrastructure.</li>
			<li>Do not resell bulk data without written agreement.</li>
			<li>Respect public API rate limits when using our API (future phases).</li>
			<li>One person per API key when accounts ship — no key sharing.</li>
		</ul>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Intellectual property & disclaimers
		</h2>
		<p class="mt-2">
			OmniCharts UI and rollup database are our property. Produced data is not open data by default. We disclaim
			warranties to the extent permitted by law and limit liability per applicable jurisdiction (governing law
			TBD).
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Termination & copyright
		</h2>
		<p class="mt-2">
			We may suspend access for abuse. Copyright concerns: contact legal@omnicharts.com. Streamer avatars and
			names are used for identification only.
		</p>
	</section>

	<p>
		<a href="/privacy" class="font-medium text-[var(--color-oc-accent)] hover:underline">Privacy Policy →</a>
	</p>
</article>
