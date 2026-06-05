<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
</script>

<SectionHeader
	title="Support OmniCharts"
	subtitle="Free, open analytics for Twitch, Kick, and YouTube — no paywalls on public stats."
/>

<article class="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-[var(--color-oc-text-muted)]">
	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Mission
		</h2>
		<p class="mt-2">
			OmniCharts measures live streaming from official platform APIs only. We publish rankings, channel
			profiles, and methodology so anyone can verify how numbers are built — without scraping
			third-party trackers or hiding data behind subscriptions.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Contact
		</h2>
		<ul class="mt-2 list-disc space-y-2 pl-5">
			<li>
				General support:
				<a href="mailto:support@omnicharts.com" class="text-[var(--color-oc-accent)] hover:underline"
					>support@omnicharts.com</a
				>
			</li>
			<li>
				Privacy requests:
				<a href="mailto:privacy@omnicharts.com" class="text-[var(--color-oc-accent)] hover:underline"
					>privacy@omnicharts.com</a
				>
			</li>
		</ul>
		<p class="mt-3 text-xs text-[var(--color-oc-text-faint)]">
			Placeholder addresses — replace before public beta per
			<a href="/privacy" class="text-[var(--color-oc-accent)] hover:underline">Privacy Policy</a>.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Support development
		</h2>
		<p class="mt-2">
			Donation links (Ko-fi, GitHub Sponsors) are coming soon. Hosting ingest and storage runs on
			Cloudflare; voluntary support helps keep the public site and API tiers free.
		</p>
	</section>

	<section class="rounded-xl border border-dashed border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			No paywall
		</h2>
		<p class="mt-2">
			Browsing rankings, channel pages, and methodology stays free. Optional API keys and exports may
			arrive in later phases with generous limits — never a hard wall on discovery.
		</p>
	</section>

	<p>
		<a href="/methodology" class="font-medium text-[var(--color-oc-accent)] hover:underline">
			How we measure →
		</a>
	</p>
</article>
