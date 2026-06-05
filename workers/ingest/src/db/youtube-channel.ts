import { PLATFORM_YOUTUBE } from '@omnicharts/domain';
import type { YoutubeChannelLookup } from '../youtube/resolve-channel';

const nowIso = () => new Date().toISOString();

export type UpsertYoutubeChannelResult = {
	id: string;
	slug: string;
	created: boolean;
};

export async function upsertYoutubeChannel(
	db: D1Database,
	lookup: YoutubeChannelLookup,
	opts: { ingestState?: 'discovered' | 'tracked' } = {}
): Promise<UpsertYoutubeChannelResult> {
	const now = nowIso();
	const id = `youtube-ch-${lookup.platformChannelId}`;
	const ingestState = opts.ingestState ?? 'discovered';

	const existing = await db
		.prepare(
			`SELECT id, slug FROM channels
       WHERE platform_id = ? AND platform_channel_id = ?`
		)
		.bind(PLATFORM_YOUTUBE, lookup.platformChannelId)
		.first<{ id: string; slug: string }>();

	if (existing) {
		await db
			.prepare(
				`UPDATE channels SET
           slug = ?,
           display_name = ?,
           avatar_url = ?,
           last_seen_at = ?
         WHERE id = ? AND platform_id = ?`
			)
			.bind(
				lookup.slug,
				lookup.displayName,
				lookup.avatarUrl,
				now,
				existing.id,
				PLATFORM_YOUTUBE
			)
			.run();

		return { id: existing.id, slug: lookup.slug, created: false };
	}

	await db
		.prepare(
			`INSERT INTO channels (
         id, platform_id, platform_channel_id, slug, display_name,
         avatar_url, first_observed_at, last_seen_at, ingest_state
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			PLATFORM_YOUTUBE,
			lookup.platformChannelId,
			lookup.slug,
			lookup.displayName,
			lookup.avatarUrl,
			now,
			now,
			ingestState
		)
		.run();

	return { id, slug: lookup.slug, created: true };
}
