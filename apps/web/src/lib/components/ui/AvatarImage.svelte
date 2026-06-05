<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		src: string;
		alt?: string;
		size?: number;
		class?: string;
		loading?: 'lazy' | 'eager';
		fetchpriority?: 'high' | 'low' | 'auto';
		rounded?: 'lg' | 'full';
	}

	let {
		src,
		alt = '',
		size = 40,
		class: className,
		loading = 'lazy',
		fetchpriority,
		rounded = 'lg'
	}: Props = $props();
</script>

<img
	{src}
	{alt}
	width={size}
	height={size}
	{loading}
	fetchpriority={fetchpriority}
	decoding="async"
	class={cn(
		'shrink-0 object-cover ring-1 ring-[var(--color-oc-border)]',
		rounded === 'full' ? 'rounded-full' : 'rounded-lg',
		className
	)}
	style:width="{size}px"
	style:height="{size}px"
/>
