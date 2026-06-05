/** URL-safe slug from Twitch login or game name */
export function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64);
}

/** Avoid UNIQUE(platform_id, slug) clashes when slugify collides distinct logins. */
export function slugWithPlatformChannelFallback(slug: string, platformChannelId: string): string {
	const suffix = `-${platformChannelId}`;
	const maxBase = Math.max(1, 64 - suffix.length);
	return `${slug.slice(0, maxBase)}${suffix}`;
}
