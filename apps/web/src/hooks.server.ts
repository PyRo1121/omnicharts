import type { Handle } from '@sveltejs/kit';

/** Allow font preloads from Google Fonts (SvelteKit performance guide). */
export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event, {
		preload: ({ type }) => type === 'font'
	});
};
