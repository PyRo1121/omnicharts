import type { YoutubeVideoItem } from './types';

export function youtubePlatformStreamId(videoId: string): string {
	return videoId;
}

export function youtubeSessionRowId(channelPlatformId: string, actualStartTime: string): string {
	const startedKey = actualStartTime.replace(/[^0-9]/g, '');
	return `yt-sess-${channelPlatformId}-${startedKey}`;
}

export function isYoutubeLive(item: YoutubeVideoItem): boolean {
	return item.snippet.liveBroadcastContent === 'live';
}

export function youtubeStreamEnded(item: YoutubeVideoItem): boolean {
	if (item.liveStreamingDetails?.actualEndTime) return true;
	const content = item.snippet.liveBroadcastContent;
	return content != null && content !== 'live' && content !== 'upcoming';
}

export function parseYoutubeConcurrentViewers(
	raw: string | number | null | undefined
): number | null {
	if (raw == null) return null;
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n) || n <= 0) return null;
	return n;
}

/** Hidden concurrent viewers — docs/05: live but no concurrentViewers is unknown. */
export function isYoutubeConcurrentViewersKnown(
	count: string | number | null | undefined
): count is string | number {
	return parseYoutubeConcurrentViewers(count) != null;
}
