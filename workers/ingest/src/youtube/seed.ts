import { PLATFORM_YOUTUBE } from '@omnicharts/domain';
import { upsertYoutubeChannel } from '../db/youtube-channel';
import type { ChannelSearchRow } from '../search/channels';
import { ingestWarn } from '../log';
import { requireDb } from '../worker-bindings';
import { shouldTryYoutubeApiSeed } from './channel-id';
import { YoutubeDataApiClient } from './api';
import { fetchYoutubeChannelByQuery } from './resolve-channel';
import { youtubeApiKeyConfigured } from './config';

export type YoutubeSeedStats = {
	seeded: number;
	skipped: number;
	errors: number;
};

export function youtubeSeedNeedsApiReason(env: Env): string | null {
	if (!youtubeApiKeyConfigured(env)) {
		return 'YOUTUBE_API_KEY not configured';
	}
	return null;
}

export async function seedYoutubeChannelByQuery(
	env: Env,
	query: string,
	opts: { promoteToTracked?: boolean } = {},
): Promise<ChannelSearchRow | null> {
	const needsApi = youtubeSeedNeedsApiReason(env);
	if (needsApi) {
		ingestWarn('[youtube] seed skipped — NEEDS_API:', needsApi);
		return null;
	}
	if (!shouldTryYoutubeApiSeed(query)) return null;

	const db = requireDb(env);
	const client = new YoutubeDataApiClient(env);
	const lookup = await fetchYoutubeChannelByQuery(client, query);
	if (!lookup) return null;

	const row = await upsertYoutubeChannel(db, lookup, {
		ingestState: opts.promoteToTracked ? 'tracked' : 'discovered',
		promoteToTracked: opts.promoteToTracked,
	});
	return {
		id: row.id,
		slug: row.slug,
		display_name: lookup.displayName,
		avatar_url: lookup.avatarUrl,
		platform_id: PLATFORM_YOUTUBE,
	};
}

export async function seedYoutubeChannels(env: Env, queries: string[]): Promise<YoutubeSeedStats> {
	const stats: YoutubeSeedStats = { seeded: 0, skipped: 0, errors: 0 };
	const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];

	for (const query of unique) {
		try {
			const row = await seedYoutubeChannelByQuery(env, query);
			if (row) stats.seeded += 1;
			else stats.skipped += 1;
		} catch (err) {
			stats.errors += 1;
			ingestWarn('[youtube] seed failed', query, err);
		}
	}

	return stats;
}
