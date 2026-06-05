import type { HelixChannel, HelixUser } from './helix';

/** JSON blob for offline channel shell from GET /channels (not live stream tags). */
export type ChannelProfileJson = {
	game_id: string;
	game_name: string;
	title: string;
	tags: string[];
	is_branded_content?: boolean;
};

export function helixChannelProfileJson(channel: HelixChannel): string {
	const payload: ChannelProfileJson = {
		game_id: channel.game_id,
		game_name: channel.game_name,
		title: channel.title,
		tags: channel.tags ?? []
	};
	if (channel.is_branded_content != null) {
		payload.is_branded_content = channel.is_branded_content;
	}
	return JSON.stringify(payload);
}

export type ChannelProfileEnrichmentRow = {
	platform_channel_id: string;
	display_name: string;
	avatar_url: string | null;
	description: string | null;
	broadcaster_type: string | null;
	platform_created_at: string | null;
	channel_profile_json: string | null;
	follower_count?: number | null;
};

export function mergeUserAndChannelProfile(
	user: HelixUser,
	channel: HelixChannel | undefined,
	followerTotal?: number | null
): ChannelProfileEnrichmentRow {
	return {
		platform_channel_id: user.id,
		display_name: user.display_name,
		avatar_url: user.profile_image_url ?? null,
		description: user.description?.trim() ? user.description : null,
		broadcaster_type: user.broadcaster_type || null,
		platform_created_at: user.created_at ?? null,
		channel_profile_json: channel ? helixChannelProfileJson(channel) : null,
		follower_count: followerTotal ?? null
	};
}
