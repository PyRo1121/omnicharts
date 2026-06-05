/** @see docs/16-search-and-resolution.md — 200ms autocomplete debounce */
export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return (...args: Parameters<T>) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	};
}
