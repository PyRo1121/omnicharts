import { isYoutubeChannelId, normalizeYoutubeHandle } from './channel-id';
import { youtubeSlugFromChannel } from './channel-slug';
import type { YoutubeDataApiClient } from './api';
import type { YoutubeChannelItem } from './types';

export type YoutubeChannelLookup = {
	platformChannelId: string;
	slug: string;
	displayName: string;
	avatarUrl: string | null;
};

export function youtubeChannelToLookup(channel: YoutubeChannelItem): YoutubeChannelLookup {
	return {
		platformChannelId: channel.id,
		slug: youtubeSlugFromChannel(channel),
		displayName: channel.snippet?.title?.trim() || channel.id,
		avatarUrl: channel.snippet?.thumbnails?.default?.url?.trim() || null,
	};
}

/** On-demand channels.list — forHandle or id= (docs/05). Never search.list. */
export async function fetchYoutubeChannelByQuery(client: YoutubeDataApiClient, rawQuery: string): Promise<YoutubeChannelLookup | null> {
	const query = rawQuery.trim();
	if (!query) return null;

	if (isYoutubeChannelId(query)) {
		const items = await client.getChannelsByIds([query]);
		const channel = items[0];
		return channel ? youtubeChannelToLookup(channel) : null;
	}

	const handle = normalizeYoutubeHandle(query);
	const channel = await client.getChannelByForHandle(handle);
	return channel ? youtubeChannelToLookup(channel) : null;
}
