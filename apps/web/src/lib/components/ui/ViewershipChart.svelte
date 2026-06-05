<script lang="ts">
	import type { ChannelDailyPoint } from '$lib/server/channel';

	interface Props {
		daily: ChannelDailyPoint[];
	}

	let { daily }: Props = $props();

	const width = 640;
	const height = 200;
	const pad = { top: 12, right: 12, bottom: 28, left: 44 };
	const innerW = width - pad.left - pad.right;
	const innerH = height - pad.top - pad.bottom;

	const sorted = $derived([...daily].sort((a, b) => a.date.localeCompare(b.date)));

	function scale(values: number[], maxPad = 1.08): (v: number) => number {
		const max = Math.max(...values, 1);
		const min = 0;
		const span = max - min || 1;
		return (v: number) => pad.top + innerH - ((v - min) / span) * innerH * maxPad;
	}

	const hwY = $derived(scale(sorted.map((d) => d.hoursWatched)));
	const avY = $derived(scale(sorted.map((d) => d.averageViewers)));

	const xAt = $derived((i: number) =>
		sorted.length <= 1
			? pad.left + innerW / 2
			: pad.left + (i / (sorted.length - 1)) * innerW
	);

	function polyline(yFn: (v: number) => number, values: number[]): string {
		return sorted
			.map((d, i) => {
				const x = xAt(i);
				const y = yFn(values[i] ?? 0);
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	const hwPath = $derived(polyline(hwY, sorted.map((d) => d.hoursWatched)));
	const avPath = $derived(polyline(avY, sorted.map((d) => d.averageViewers)));

	function formatDate(iso: string): string {
		const d = new Date(iso + 'T12:00:00Z');
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<figure class="w-full min-h-[200px]" aria-label="Daily hours watched and average viewers">
	<svg
		viewBox="0 0 {width} {height}"
		width={width}
		height={height}
		class="h-auto w-full max-w-full text-[var(--color-oc-text-faint)]"
		role="img"
	>
		<line
			x1={pad.left}
			y1={pad.top + innerH}
			x2={pad.left + innerW}
			y2={pad.top + innerH}
			stroke="currentColor"
			stroke-opacity="0.25"
		/>
		<path
			d={hwPath}
			fill="none"
			stroke="var(--color-oc-accent)"
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		<path
			d={avPath}
			fill="none"
			stroke="var(--color-oc-highlight)"
			stroke-width="2"
			stroke-dasharray="4 3"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		{#each sorted as point, i (point.date)}
			<circle
				cx={xAt(i)}
				cy={hwY(point.hoursWatched)}
				r="3"
				fill="var(--color-oc-accent)"
			/>
			<text
				x={xAt(i)}
				y={height - 6}
				text-anchor="middle"
				class="fill-[var(--color-oc-text-faint)] text-[9px]"
			>
				{formatDate(point.date)}
			</text>
		{/each}
	</svg>
	<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-oc-text-muted)]">
		<li class="flex items-center gap-2">
			<span class="inline-block h-0.5 w-4 bg-[var(--color-oc-accent)]" aria-hidden="true"></span>
			Hours watched (per day, independent scale)
		</li>
		<li class="flex items-center gap-2">
			<span
				class="inline-block h-0.5 w-4 border-t-2 border-dashed border-[var(--color-oc-highlight)]"
				aria-hidden="true"
			></span>
			Avg viewers (per day, independent scale)
		</li>
	</ul>
	<table class="sr-only">
		<caption>Daily rollup data</caption>
		<thead>
			<tr>
				<th scope="col">Date</th>
				<th scope="col">Hours watched</th>
				<th scope="col">Average viewers</th>
				<th scope="col">Peak viewers</th>
			</tr>
		</thead>
		<tbody>
			{#each sorted as point (point.date)}
				<tr>
					<td>{point.date}</td>
					<td>{point.hoursWatched.toLocaleString()}</td>
					<td>{point.averageViewers.toLocaleString()}</td>
					<td>{point.peakViewers.toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</figure>
