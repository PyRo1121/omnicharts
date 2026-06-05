/** GET /public/v1/livestreams — Kick Dev Public API v1 */
export type KickCategory = {
	id: number;
	name: string;
	thumbnail?: string;
};

export type KickLivestream = {
	broadcaster_user_id: number;
	channel_id: number;
	slug: string;
	stream_title: string;
	started_at: string;
	viewer_count?: number | null;
	language?: string;
	profile_picture?: string;
	thumbnail?: string;
	has_mature_content?: boolean;
	custom_tags?: string[];
	category?: KickCategory | null;
};

export type KickApiListResponse<T> = {
	data: T[];
	message?: string;
};

/** GET /public/v2/categories — paginated category list */
export type KickCategoryWithTags = {
	id: number;
	name: string;
	tags?: string[];
	thumbnail?: string;
};

export type KickPaginatedResponse<T> = {
	data: T[];
	message?: string;
	pagination?: { next_cursor?: string };
};

/** GET /public/v1/channels — slug or broadcaster_user_id lookup */
export type KickChannel = {
	broadcaster_user_id: number;
	channel_id: number;
	slug: string;
	stream_title?: string;
	viewer_count?: number | null;
};
