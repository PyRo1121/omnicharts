/** Twitch Helix user/channel ids are numeric strings (snowflakes). */
export function isHelixTwitchUserId(platformChannelId: string): boolean {
	return /^\d+$/.test(platformChannelId);
}

/** Dev seed rows use `dev-N` platform ids — invalid for Helix batch APIs. */
export function isDevSeedPlatformChannelId(platformChannelId: string): boolean {
	return platformChannelId.startsWith('dev-') || platformChannelId.startsWith('dev_');
}

export function filterHelixTwitchUserIds(ids: string[]): string[] {
	return ids.filter((id) => isHelixTwitchUserId(id) && !isDevSeedPlatformChannelId(id));
}
