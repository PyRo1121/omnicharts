<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
</script>

<svelte:head>
	<title>How we measure stats · OmniCharts</title>
	<meta
		name="description"
		content="How OmniCharts calculates Hours Watched, Average Viewers, and rankings for Twitch, Kick, and YouTube using official APIs."
	/>
</svelte:head>

<SectionHeader
	title="How we measure streaming statistics"
	subtitle="Official platform APIs only — no third-party tracker scraping. Technical definitions: docs/04-metrics-glossary."
/>

<article class="prose-oc mt-8 max-w-2xl space-y-6 text-sm leading-relaxed text-[var(--color-oc-text-muted)]">
	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Introduction
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
		<p class="mt-2">
			<strong class="text-[var(--color-oc-text)]">Tracked since</strong> on each channel profile is the date we
			first started recording that channel. We cannot show minute-by-minute history from before that date.
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
			When the API provides follower totals, we store snapshots and show the difference over the period. If data
			is missing, we show “—”.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			How often we update (by platform)
		</h2>
		<div class="mt-3 overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead>
					<tr class="border-b border-[var(--color-oc-border)] text-[var(--color-oc-text)]">
						<th class="py-2 pr-3 font-semibold">Platform</th>
						<th class="py-2 pr-3 font-semibold">Sample interval (live)</th>
						<th class="py-2 font-semibold">Status</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-b border-[var(--color-oc-border)]">
						<td class="py-2 pr-3">Twitch</td>
						<td class="py-2 pr-3">~60 seconds</td>
						<td class="py-2">Helix poll + EventSub lifecycle</td>
					</tr>
					<tr class="border-b border-[var(--color-oc-border)]">
						<td class="py-2 pr-3">Kick</td>
						<td class="py-2 pr-3">~60–120 seconds</td>
						<td class="py-2">Livestreams poll when API credentials configured; optional webhooks for session boundaries</td>
					</tr>
					<tr>
						<td class="py-2 pr-3">YouTube</td>
						<td class="py-2 pr-3">~120 seconds (target)</td>
						<td class="py-2">Tracked <code class="text-xs">videos.list</code> poll for channels we follow — quota-limited; hidden viewer counts omitted</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-3">
			Rankings and charts use <strong class="text-[var(--color-oc-text)]">daily rollups</strong> built from samples.
			Public pages may cache for up to <strong class="text-[var(--color-oc-text)]">60 seconds</strong>. We do not poll
			offline channels every minute.
		</p>
		<p class="mt-2">
			Raw <code class="text-xs">viewer_samples</code> for Twitch are kept in a
			<strong class="text-[var(--color-oc-text)]">14-day hot window</strong>, then pruned after daily rollup. Older
			detail is not on public pages until cold archive (Phase 4).
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Who appears in rankings
		</h2>
		<p class="mt-2">Public leaderboards include channels that meet all of:</p>
		<ul class="mt-2 list-disc space-y-1 pl-5">
			<li>Actively <strong class="text-[var(--color-oc-text)]">tracked</strong> in our system</li>
			<li>At least <strong class="text-[var(--color-oc-text)]">60 minutes</strong> of live airtime in the selected period</li>
			<li>Period average viewers at least about <strong class="text-[var(--color-oc-text)]">2</strong> concurrent viewers (platform thresholds may differ)</li>
		</ul>
		<p class="mt-2">
			Smaller or newly discovered channels may still have a profile with limited history. We discover from live
			directories and popular categories — not every account on a platform.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			History and tracked since
		</h2>
		<p class="mt-2">
			We only have detailed viewer curves from the day we started tracking a channel forward. Platforms do not expose
			full lifetime third-party history. Twitch VODs expire after a short window; Kick and YouTube do not provide years
			of concurrent viewer curves via public APIs.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Discovery (how channels enter the catalog)
		</h2>
		<ul class="mt-2 list-disc space-y-2 pl-5">
			<li>
				<strong class="text-[var(--color-oc-text)]">Twitch</strong> — global live directory sweep, rotating game-category
				passes, and reconcile of recently tracked channels (see ADR-0006 for pagination coverage).
			</li>
			<li>
				<strong class="text-[var(--color-oc-text)]">Kick</strong> — category discovery from the public API plus tracked
				livestream polling (≤50 broadcaster IDs per request). Without developer API credentials, discover/poll no-op.
			</li>
			<li>
				<strong class="text-[var(--color-oc-text)]">YouTube</strong> — design: known channel IDs and live video IDs via
				Data API; no sitewide search cron. Ingest not live yet.
			</li>
		</ul>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Known limitations
		</h2>
		<ul class="mt-2 list-disc space-y-1 pl-5">
			<li>We generally show concurrent viewers and Hours Watched, not unique people.</li>
			<li>Raids and hosts are included in samples during the live window.</li>
			<li>Some Kick or YouTube streams hide viewer counts — we may show gaps.</li>
			<li>YouTube Gaming coverage is a subset, not the entire site; leaderboards stay empty until ingest ships.</li>
			<li>Other analytics sites use different ingest — numbers may disagree.</li>
		</ul>
	</section>

	<section class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
		<h2 class="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-oc-text)]">
			Cross-platform, sources, affiliation
		</h2>
		<p class="mt-2">
			Twitch, Kick, and YouTube use separate tables and pages. Do not add Hours Watched across platforms unless
			explicitly labeled as combined.
		</p>
		<p class="mt-2">
			Data sources:
			<a
				href="https://dev.twitch.tv/docs/api/"
				class="text-[var(--color-oc-accent)] hover:underline"
				rel="noopener noreferrer">Twitch Helix</a
			>
			and EventSub;
			<a
				href="https://docs.kick.com/"
				class="text-[var(--color-oc-accent)] hover:underline"
				rel="noopener noreferrer">Kick Developer API</a
			>;
			<a
				href="https://developers.google.com/youtube/v3"
				class="text-[var(--color-oc-accent)] hover:underline"
				rel="noopener noreferrer">YouTube Data API</a
			> (when implemented).
		</p>
		<p class="mt-2">
			OmniCharts is not affiliated with, endorsed by, or sponsored by Twitch, Kick, YouTube, or Google.
		</p>
	</section>
</article>
