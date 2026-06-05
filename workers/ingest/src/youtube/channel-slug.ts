import { slugify, slugWithPlatformChannelFallback } from '../twitch/slug';
import type { YoutubeChannelItem } from './types';

export function youtubeSlugFromChannel(channel: YoutubeChannelItem): string {
	const customUrl = channel.snippet?.customUrl?.trim();
	if (customUrl) {
		const handle = customUrl.replace(/^@+/, '');
		const slug = slugify(handle);
		if (slug) return slug;
	}

	const titleSlug = slugify(channel.snippet?.title?.trim() ?? '');
	if (titleSlug) return titleSlug;
	return slugWithPlatformChannelFallback('channel', channel.id);
}
