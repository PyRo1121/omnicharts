<script module lang="ts">
	import type { ChannelRow, GameRow } from '$lib/mock/home';
	import type { PlatformId } from '$lib/ui/platform.svelte';

	export type LeaderboardRow = {
		rank: number;
		href: string;
		primary: string;
		secondary?: string;
		imageUrl: string;
		imageAlt: string;
		metric: string;
		metricLabel: string;
		platform?: Exclude<PlatformId, 'all'>;
	};

	export function channelLeaderboardRows(rows: ChannelRow[]): LeaderboardRow[] {
		return rows.map((c) => ({
			rank: c.rank,
			href: `/channels/${c.slug}?platform=${c.platform}`,
			primary: c.displayName,
			imageUrl: c.avatarUrl,
			imageAlt: c.displayName,
			metric: c.metric,
			metricLabel: c.metricLabel,
			platform: c.platform
		}));
	}

	export function gameLeaderboardRows(rows: GameRow[]): LeaderboardRow[] {
		return rows.map((g) => ({
			rank: g.rank,
			href: `/games/${g.slug}?platform=${g.platform}`,
			primary: g.name,
			imageUrl: g.boxArtUrl,
			imageAlt: g.name,
			metric: g.metric,
			metricLabel: g.metricLabel,
			platform: g.platform
		}));
	}
</script>

<script lang="ts">
	import AvatarImage from '$lib/components/ui/AvatarImage.svelte';
	import { cn } from '$lib/utils/cn';
	import { platformLabel } from '$lib/ui/platform.svelte';

	interface Props {
		rows: LeaderboardRow[];
		metricHeader: string;
		/** Shown as a single row when `rows` is empty (unsupported platform, no rollups, etc.). */
		emptyMessage?: string | null;
	}

	let { rows, metricHeader, emptyMessage = null }: Props = $props();

	type RowPlatform = NonNullable<LeaderboardRow['platform']>;

	const rowPlatformLabel: Record<RowPlatform, string> = {
		twitch: platformLabel('twitch'),
		kick: platformLabel('kick'),
		youtube: platformLabel('youtube')
	};
</script>

<div class="overflow-hidden rounded-xl border border-[var(--color-oc-border)] bg-[var(--color-oc-bg-card)]">
	<table class="w-full text-left text-sm">
		<thead>
			<tr class="border-b border-[var(--color-oc-border-subtle)] text-xs uppercase tracking-wider text-[var(--color-oc-text-faint)]">
				<th scope="col" class="w-12 px-4 py-3 font-medium">#</th>
				<th scope="col" class="px-4 py-3 font-medium">Name</th>
				<th scope="col" class="hidden px-4 py-3 font-medium sm:table-cell">Platform</th>
				<th scope="col" class="px-4 py-3 text-right font-medium">{metricHeader}</th>
			</tr>
		</thead>
		<tbody>
			{#if rows.length === 0}
				<tr>
					<td colspan="4" class="px-4 py-8 text-center text-sm text-[var(--color-oc-text-muted)]">
						{emptyMessage ?? 'No results for this period.'}
					</td>
				</tr>
			{:else}
				{#each rows as row (`${row.rank}-${row.href}`)}
					<tr
						class="group border-b border-[var(--color-oc-border-subtle)] last:border-0 transition-colors hover:bg-[var(--color-oc-bg-hover)]"
					>
						<td class="px-4 py-3">
							<span
								class={cn(
									'inline-flex size-7 items-center justify-center rounded-md font-mono text-xs font-semibold',
									row.rank <= 3
										? 'bg-[color-mix(in_oklab,var(--color-oc-highlight)_20%,transparent)] text-[var(--color-oc-highlight)]'
										: 'bg-[var(--color-oc-bg-elevated)] text-[var(--color-oc-text-muted)]'
								)}
							>
								{row.rank}
							</span>
						</td>
						<td class="px-4 py-3">
							<a href={row.href} class="flex min-w-0 items-center gap-3">
								<AvatarImage src={row.imageUrl} alt={row.imageAlt} size={40} />
								<span class="min-w-0">
									<span
										class="block truncate font-medium text-[var(--color-oc-text)] group-hover:text-[var(--color-oc-accent)]"
									>
										{row.primary}
									</span>
									{#if row.secondary}
										<span class="block truncate text-xs text-[var(--color-oc-text-faint)]">{row.secondary}</span>
									{/if}
								</span>
							</a>
						</td>
						<td class="hidden px-4 py-3 sm:table-cell">
							{#if row.platform}
								<span class="text-xs text-[var(--color-oc-text-muted)]">{rowPlatformLabel[row.platform]}</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right">
							<span class="font-mono text-sm font-medium tabular-nums text-[var(--color-oc-text)]">{row.metric}</span>
							<span class="mt-0.5 block text-[10px] uppercase tracking-wide text-[var(--color-oc-text-faint)]">
								{row.metricLabel}
							</span>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
