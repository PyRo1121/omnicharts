import type { KickLivestream } from './types';

export function kickPlatformStreamIdFromChannelId(channelId: number | string, startedAt: string): string {
	return `${channelId}-${startedAt}`;
}

export function kickSessionRowIdFromChannelId(channelId: number | string, startedAt: string): string {
	const startedKey = startedAt.replace(/[^0-9]/g, '');
	return `kick-sess-${channelId}-${startedKey}`;
}

export function kickPlatformStreamId(stream: KickLivestream): string {
	return kickPlatformStreamIdFromChannelId(stream.channel_id, stream.started_at);
}

export function kickSessionRowId(stream: KickLivestream): string {
	return kickSessionRowIdFromChannelId(stream.channel_id, stream.started_at);
}

export function kickBroadcasterId(stream: KickLivestream): string {
	return String(stream.broadcaster_user_id);
}

/** Hidden viewer counts — docs/05: missing/null/ambiguous 0 while live is unknown. */
export function isKickViewerCountKnown(count: number | null | undefined): count is number {
	return typeof count === 'number' && Number.isFinite(count) && count > 0;
}

export function kickTagsJson(tags: string[] | undefined): string | null {
	if (!tags?.length) return null;
	return JSON.stringify(tags);
}

export function kickStreamSessionPersist(stream: KickLivestream): {
	language: string | null;
	tags_json: string | null;
	thumbnail_url: string | null;
	stream_type: string | null;
} {
	return {
		language: stream.language ?? null,
		tags_json: kickTagsJson(stream.custom_tags),
		thumbnail_url: stream.thumbnail ?? null,
		stream_type: 'live',
	};
}
