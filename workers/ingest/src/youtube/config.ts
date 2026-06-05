/** YouTube ingest caps — docs/05, docs/12 */

import { PLATFORM_LIVE_STREAM_CAP } from '../ingest-budget';

/** videos.list accepts comma-separated ids — hard limit 50 per request. */
export const YOUTUBE_VIDEOS_BATCH_SIZE = 50;

export const DEFAULT_YOUTUBE_MAX_TRACKED = PLATFORM_LIVE_STREAM_CAP.youtube;

export const DEFAULT_YOUTUBE_MIN_VIEWERS = 2;

export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export function youtubeMinViewersFromEnv(env: Env): number {
	const n = Number(env.YOUTUBE_MIN_VIEWERS ?? env.TWITCH_MIN_VIEWERS ?? DEFAULT_YOUTUBE_MIN_VIEWERS);
	return Number.isFinite(n) && n >= 0 ? n : DEFAULT_YOUTUBE_MIN_VIEWERS;
}

export function youtubeMaxTrackedFromEnv(env: Env): number {
	const n = Number(env.YOUTUBE_MAX_TRACKED ?? DEFAULT_YOUTUBE_MAX_TRACKED);
	return Number.isFinite(n) && n > 0 ? n : DEFAULT_YOUTUBE_MAX_TRACKED;
}

export function youtubeApiKeyConfigured(env: Env): boolean {
	return Boolean(env.YOUTUBE_API_KEY?.trim());
}
