<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { onMount } from 'svelte';

	type IngestHealth = {
		status: string;
		service: string;
		db: string;
		twitch: string;
		last_rollup_at: string | null;
		discovery_seed_at?: string | null;
		tracked_channels: { twitch: number };
		ingest_state_counts?: {
			twitch: { discovered: number; tracked: number; dormant: number; retired: number };
		};
		channels_live?: number;
		discovery_new_24h?: number;
		ingest_lag_seconds?: { twitch: number | null };
		timestamp: string;
	};

	const ingestBase = import.meta.env.VITE_INGEST_URL ?? 'http://127.0.0.1:8787';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let health = $state<IngestHealth | null>(null);

	onMount(async () => {
		try {
			const res = await fetch(`${ingestBase}/health`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			health = (await res.json()) as IngestHealth;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	});
</script>

<SectionHeader
	title="Ingest health (dev)"
	subtitle="Live status from the ingest Worker — run `bun run dev:ingest` locally."
/>

<p class="mt-2 text-sm text-[var(--color-oc-text-muted)]">
	Base URL: <code class="font-mono text-[var(--color-oc-text)]">{ingestBase}</code>
</p>

{#if loading}
	<p class="mt-8 text-sm text-[var(--color-oc-text-muted)]">Loading…</p>
{:else if error}
	<div
		class="mt-8 rounded-xl border border-[var(--color-oc-danger)]/40 bg-[var(--color-oc-bg-card)] p-5 text-sm text-[var(--color-oc-text)]"
	>
		<p class="font-medium">Could not reach ingest</p>
		<p class="mt-2 text-[var(--color-oc-text-muted)]">{error}</p>
	</div>
{:else if health}
	<dl class="mt-8 grid gap-4 sm:grid-cols-2">
		<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
			<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Status</dt>
			<dd class="mt-2 font-mono text-lg text-[var(--color-oc-text)]">{health.status}</dd>
		</div>
		<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
			<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Database</dt>
			<dd class="mt-2 font-mono text-lg text-[var(--color-oc-text)]">{health.db}</dd>
		</div>
		<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
			<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Twitch</dt>
			<dd class="mt-2 font-mono text-lg text-[var(--color-oc-text)]">{health.twitch}</dd>
		</div>
		<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
			<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Tracked channels</dt>
			<dd class="mt-2 font-mono text-lg text-[var(--color-oc-text)]">
				{health.tracked_channels.twitch}
			</dd>
		</div>
		<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
			<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Live sessions</dt>
			<dd class="mt-2 font-mono text-lg text-[var(--color-oc-text)]">
				{health.channels_live ?? '—'}
			</dd>
		</div>
		<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
			<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">New (24h)</dt>
			<dd class="mt-2 font-mono text-lg text-[var(--color-oc-text)]">
				{health.discovery_new_24h ?? '—'}
			</dd>
		</div>
		<div class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5">
			<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Ingest lag (s)</dt>
			<dd class="mt-2 font-mono text-lg text-[var(--color-oc-text)]">
				{health.ingest_lag_seconds?.twitch ?? '—'}
			</dd>
		</div>
		<div
			class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5 sm:col-span-2"
		>
			<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">Last rollup</dt>
			<dd class="mt-2 font-mono text-sm text-[var(--color-oc-text)]">
				{health.last_rollup_at ?? '—'}
			</dd>
		</div>
		{#if health.ingest_state_counts}
			<div
				class="rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)] p-5 sm:col-span-2"
			>
				<dt class="text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">
					Ingest states (Twitch)
				</dt>
				<dd class="mt-2 flex flex-wrap gap-3 font-mono text-sm text-[var(--color-oc-text)]">
					{#each Object.entries(health.ingest_state_counts.twitch) as [state, n] (state)}
						<span>{state}: {n}</span>
					{/each}
				</dd>
			</div>
		{/if}
	</dl>
	<pre
		class="mt-6 overflow-x-auto rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-elevated)] p-4 text-xs text-[var(--color-oc-text-muted)]"
	>{JSON.stringify(health, null, 2)}</pre>
{/if}
