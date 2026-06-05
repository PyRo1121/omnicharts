import { chunkArray } from '../db/d1-batch';
import { YOUTUBE_API_BASE, YOUTUBE_VIDEOS_BATCH_SIZE, youtubeApiKeyConfigured } from './config';
import type { YoutubeVideoItem, YoutubeVideoListResponse } from './types';

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
			throw new Error(`YouTube videos.list ${res.status}: ${body.slice(0, 200)}`);
		}

		const json = (await res.json()) as YoutubeVideoListResponse;
		return json.items ?? [];
	}
}
