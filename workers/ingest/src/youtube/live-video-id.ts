import type { YoutubeDataApiClient } from './api';
import type { YoutubePlaylistItem } from './types';

/** First uploads-playlist item with live broadcast (docs/05 playlistItems.list). */
export function pickLiveVideoIdFromPlaylistItems(items: YoutubePlaylistItem[]): string | null {
	for (const item of items) {
		const videoId = item.snippet?.resourceId?.videoId?.trim();
		if (!videoId) continue;
		if (item.snippet?.liveBroadcastContent === 'live') return videoId;
	}
	return null;
}

export async function resolveYoutubeLiveVideoId(
	client: YoutubeDataApiClient,
	platformChannelId: string
): Promise<string | null> {
	const uploadsPlaylistId = await client.getUploadsPlaylistId(platformChannelId);
	if (!uploadsPlaylistId) return null;
	const items = await client.getPlaylistItems(uploadsPlaylistId, 15);
	return pickLiveVideoIdFromPlaylistItems(items);
}
