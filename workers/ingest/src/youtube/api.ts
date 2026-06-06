import { chunkArray } from '../db/d1-batch';
import { parseYoutubeChannelListResponse, parseYoutubePlaylistItemsResponse, parseYoutubeVideoListResponse } from '../json-guards';
import { YOUTUBE_API_BASE, YOUTUBE_VIDEOS_BATCH_SIZE, youtubeApiKeyConfigured } from './config';
import { youtubeApiHttpError } from './api-errors';
import type { YoutubeChannelItem, YoutubeVideoItem } from './types';

export class YoutubeDataApiClient {
	constructor(private readonly env: Env) {}

	private requireApiKey(): string {
		const key = this.env.YOUTUBE_API_KEY?.trim();
		if (!key) {
			throw new Error('Missing YOUTUBE_API_KEY');
		}
		return key;
	}

	async getVideosByIds(videoIds: string[]): Promise<YoutubeVideoItem[]> {
		if (videoIds.length === 0) return [];
		if (!youtubeApiKeyConfigured(this.env)) {
			throw new Error('Missing YOUTUBE_API_KEY');
		}

		const chunks = chunkArray(videoIds, YOUTUBE_VIDEOS_BATCH_SIZE);
		const out: YoutubeVideoItem[] = [];
		for (const ids of chunks) {
			out.push(...(await this.getVideosBatch(ids)));
		}
		return out;
	}

	private async getVideosBatch(videoIds: string[]): Promise<YoutubeVideoItem[]> {
		const key = this.requireApiKey();
		const params = new URLSearchParams();
		params.set('part', 'liveStreamingDetails,snippet');
		params.set('id', videoIds.join(','));
		params.set('key', key);

		const url = `${YOUTUBE_API_BASE}/videos?${params.toString()}`;
		const res = await fetch(url);
		if (!res.ok) {
			const body = await res.text();
			throw youtubeApiHttpError('videos.list', res.status, body);
		}

		const json = parseYoutubeVideoListResponse(await res.json());
		return json.items ?? [];
	}

	async getChannelsByIds(channelIds: string[]): Promise<YoutubeChannelItem[]> {
		const ids = channelIds.map((id) => id.trim()).filter(Boolean);
		if (ids.length === 0) return [];
		if (!youtubeApiKeyConfigured(this.env)) {
			throw new Error('Missing YOUTUBE_API_KEY');
		}

		const key = this.requireApiKey();
		const params = new URLSearchParams();
		params.set('part', 'id,snippet');
		params.set('id', ids.join(','));
		params.set('key', key);

		const url = `${YOUTUBE_API_BASE}/channels?${params.toString()}`;
		const res = await fetch(url);
		if (!res.ok) {
			const body = await res.text();
			throw youtubeApiHttpError('channels.list', res.status, body);
		}

		const json = parseYoutubeChannelListResponse(await res.json());
		return json.items ?? [];
	}

	/** Handle → channel (1 quota unit). @see docs/05 channels.list forHandle */
	async getChannelByForHandle(handle: string): Promise<YoutubeChannelItem | null> {
		const normalized = handle.trim().replace(/^@+/, '');
		if (!normalized) return null;
		if (!youtubeApiKeyConfigured(this.env)) {
			throw new Error('Missing YOUTUBE_API_KEY');
		}

		const key = this.requireApiKey();
		const params = new URLSearchParams();
		params.set('part', 'id,snippet');
		params.set('forHandle', normalized);
		params.set('key', key);

		const url = `${YOUTUBE_API_BASE}/channels?${params.toString()}`;
		const res = await fetch(url);
		if (!res.ok) {
			const body = await res.text();
			throw youtubeApiHttpError('channels.list', res.status, body);
		}

		const json = parseYoutubeChannelListResponse(await res.json());
		return json.items?.[0] ?? null;
	}

	async getUploadsPlaylistId(channelId: string): Promise<string | null> {
		if (!youtubeApiKeyConfigured(this.env)) {
			throw new Error('Missing YOUTUBE_API_KEY');
		}
		const key = this.requireApiKey();
		const params = new URLSearchParams();
		params.set('part', 'contentDetails');
		params.set('id', channelId);
		params.set('key', key);

		const url = `${YOUTUBE_API_BASE}/channels?${params.toString()}`;
		const res = await fetch(url);
		if (!res.ok) {
			const body = await res.text();
			throw youtubeApiHttpError('channels.list', res.status, body);
		}

		const json = parseYoutubeChannelListResponse(await res.json());
		const uploads = json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads?.trim();
		return uploads || null;
	}

	async getPlaylistItems(playlistId: string, maxResults = 15) {
		if (!youtubeApiKeyConfigured(this.env)) {
			throw new Error('Missing YOUTUBE_API_KEY');
		}
		const key = this.requireApiKey();
		const params = new URLSearchParams();
		params.set('part', 'snippet');
		params.set('playlistId', playlistId);
		params.set('maxResults', String(Math.min(50, Math.max(1, maxResults))));
		params.set('key', key);

		const url = `${YOUTUBE_API_BASE}/playlistItems?${params.toString()}`;
		const res = await fetch(url);
		if (!res.ok) {
			const body = await res.text();
			throw youtubeApiHttpError('playlistItems.list', res.status, body);
		}

		const json = parseYoutubePlaylistItemsResponse(await res.json());
		return json.items ?? [];
	}
}
