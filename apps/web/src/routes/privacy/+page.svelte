<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	<title>Privacy Policy — OmniCharts</title>
</svelte:head>

<SectionHeader
	title="Privacy Policy"
	subtitle="Draft — not legal advice. Attorney review required before public beta."
/>

<article class="mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-[var(--color-oc-text-muted)]">
	<p class="rounded-lg border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] px-4 py-3 text-xs text-[var(--color-oc-text-faint)]">
		Placeholder policy outline from our compliance checklist. Contact:
		<a href="mailto:privacy@omnicharts.com" class="text-[var(--color-oc-accent)] hover:underline"
			>privacy@omnicharts.com</a
		>
	</p>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Data we collect
		</h2>
		<ul class="mt-2 list-disc space-y-2 pl-5">
			<li>
				<strong class="text-[var(--color-oc-text)]">Public platform data</strong> — channel names, slugs,
				viewer samples, stream titles (core product).
			</li>
			<li>
				<strong class="text-[var(--color-oc-text)]">Technical logs</strong> — IP, User-Agent, request path
				(security, abuse, SLOs).
			</li>
			<li>
				<strong class="text-[var(--color-oc-text)]">Cookies</strong> — session and analytics cookies if
				enabled (functionality / analytics).
			</li>
			<li>
				<strong class="text-[var(--color-oc-text)]">Account data (future)</strong> — email, API key hash for
				auth.
			</li>
		</ul>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Data we do not collect (v1)
		</h2>
		<p class="mt-2">
			Twitch chat content, passwords stored locally, or government IDs. v1 is read-only public stats from
			official APIs.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Retention
		</h2>
		<ul class="mt-2 list-disc space-y-1 pl-5">
			<li>Raw viewer samples (hot): 14 days in D1</li>
			<li>Daily rollups: per product milestones (30d → 365d)</li>
			<li>Server logs: 30–90 days</li>
			<li>API keys: until revoked + 30 days</li>
		</ul>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Your rights & subprocessors
		</h2>
		<p class="mt-2">
			EU/UK users may request access, rectification, erasure, or portability for personal data in logs or
			accounts. Public channel stats may remain as aggregated historical facts — counsel to qualify.
		</p>
		<p class="mt-2">
			Hosting and storage run on Cloudflare (Workers, D1, R2, CDN). Future email or analytics providers will
			be listed here before use.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Children & international transfers
		</h2>
		<p class="mt-2">
			Service not directed at children under 13. Cloudflare’s global network may process data outside your
			country under applicable transfer mechanisms.
		</p>
	</section>

	<p>
		<a href="/terms" class="font-medium text-[var(--color-oc-accent)] hover:underline">Terms of Service →</a>
	</p>
</article>
