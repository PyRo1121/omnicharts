/** @see docs/16-search-and-resolution.md — 200ms autocomplete debounce */
export function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return ((...args: Parameters<T>) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	}) as T;
}
