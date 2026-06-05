<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
</script>

<SectionHeader
	title="How we measure streaming statistics"
	subtitle="Official platform APIs only — no third-party tracker scraping. Technical definitions: docs/04-metrics-glossary."
/>

<article class="prose-oc mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-[var(--color-oc-text-muted)]">
	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Data sources
		</h2>
		<p class="mt-2">
			We collect public data from <strong class="text-[var(--color-oc-text)]">Twitch</strong>,
			<strong class="text-[var(--color-oc-text)]">Kick</strong>, and
			<strong class="text-[var(--color-oc-text)]">YouTube</strong> through each platform’s official APIs.
			We do not buy or scrape third-party analytics databases.
		</p>
		<p class="mt-2">
			Numbers are <strong class="text-[var(--color-oc-text)]">estimates of viewership activity</strong> from
			how many people were watching at sample moments — not platform-internal dashboards or unique-people
			counts unless stated.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Hours Watched (HW)
		</h2>
		<p class="mt-2">
			Primary ranking metric for “most watched” lists. While a channel is live we add viewer counts over time:
		</p>
		<p class="mt-2 font-mono text-xs text-[var(--color-oc-text)]">
			Hours Watched ≈ Σ (concurrent viewers × time between samples)
		</p>
		<p class="mt-2">
			With ~one sample per minute, each sample contributes roughly <code class="text-xs">viewers ÷ 60</code>
			hours. Offline time is excluded.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Average Viewers (AV)
		</h2>
		<p class="mt-2">
			<strong class="text-[var(--color-oc-text)]">Average Viewers = Hours Watched ÷ hours live</strong> in the
			selected period. This is a time-weighted average, not an average of daily peaks.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Peak viewers, airtime, stream count
		</h2>
		<ul class="mt-2 list-disc space-y-1 pl-5">
			<li><strong class="text-[var(--color-oc-text)]">Peak viewers</strong> — highest concurrent count observed in the period.</li>
			<li><strong class="text-[var(--color-oc-text)]">Airtime</strong> — total live time in the period from platform online signals.</li>
			<li><strong class="text-[var(--color-oc-text)]">Stream count</strong> — distinct broadcasts that started in the period.</li>
		</ul>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Follower change
		</h2>
		<p class="mt-2">
			When the API provides follower totals, we store daily snapshots and compute
			<strong class="text-[var(--color-oc-text)]">followers gain</strong> as the sum of day-over-day
			<code class="text-xs">followers_delta</code> over the period. Missing snapshots show as “—” on the site.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Sampling and hot retention
		</h2>
		<p class="mt-2">
			Twitch live channels are typically sampled about <strong class="text-[var(--color-oc-text)]">once per minute</strong>
			while online (Helix + EventSub where available). Rankings and charts use <strong class="text-[var(--color-oc-text)]">daily rollups</strong>
			built from those samples.
		</p>
		<p class="mt-2">
			Raw <code class="text-xs">viewer_samples</code> rows are kept in our database for a
			<strong class="text-[var(--color-oc-text)]">14-day hot window</strong>, then pruned after the daily rollup.
			Older detail is not shown on public pages until cold archive (Phase 4).
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Who appears in rankings
		</h2>
		<p class="mt-2">Public leaderboards include channels that meet all of:</p>
		<ul class="mt-2 list-disc space-y-1 pl-5">
			<li>Actively <strong class="text-[var(--color-oc-text)]">tracked</strong> in our system</li>
			<li>At least <strong class="text-[var(--color-oc-text)]">60 minutes</strong> of live airtime in the selected period (production default)</li>
			<li>Period average viewers at least the platform track threshold (20+ on Twitch at launch)</li>
		</ul>
		<p class="mt-2">
			Smaller or newly discovered channels may still have a profile with limited history. We discover from live
			directories and popular categories — not every account on a platform.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Tracked since and history limits
		</h2>
		<p class="mt-2">
			<strong class="text-[var(--color-oc-text)]">Tracked since</strong> is the date we first recorded the channel.
			We only have minute-level viewer curves from that date forward — platforms do not expose full lifetime
			third-party history.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Live discovery
		</h2>
		<p class="mt-2">
			Each minute we sweep the global live directory, rotate game-category passes, and reconcile recently
			tracked channels — see ADR-0006 for pagination coverage.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Cross-platform and affiliation
		</h2>
		<p class="mt-2">
			Twitch, Kick, and YouTube use separate tables and pages. Do not add Hours Watched across platforms unless
			labeled as combined.
		</p>
		<p class="mt-2">
			OmniCharts is not affiliated with, endorsed by, or sponsored by Twitch, Kick, YouTube, or Google.
		</p>
	</section>
</article>
