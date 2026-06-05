/** YouTube Data API v3 — videos.list resource (subset). @see developers.google.com/youtube/v3/docs/videos */

export type YoutubeVideoItem = {
	id: string;
	snippet: {
		channelId: string;
		title: string;
		liveBroadcastContent?: string;
		categoryId?: string;
	};
	liveStreamingDetails?: {
		actualStartTime?: string;
		actualEndTime?: string;
		/** API returns string or number; hidden when broadcaster disables view count. */
		concurrentViewers?: string | number;
	};
};

export type YoutubeVideoListResponse = {
	items?: YoutubeVideoItem[];
};

export type YoutubeChannelItem = {
	id: string;
	snippet?: {
		title?: string;
		customUrl?: string;
		thumbnails?: { default?: { url?: string } };
	};
	contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

export type YoutubeChannelListResponse = {
	items?: YoutubeChannelItem[];
};

export type YoutubePlaylistItem = {
	snippet?: {
		resourceId?: { videoId?: string };
		liveBroadcastContent?: string;
	};
};

export type YoutubePlaylistItemsResponse = {
	items?: YoutubePlaylistItem[];
};
