import { PLATFORM_KICK } from '@omnicharts/domain';
import { chunkArray, D1_BATCH_MAX_STATEMENTS, maxRowsPerInsert, runD1Batches } from './d1-batch';
import {
	batchCloseStaleOpenSessionsForChannels,
	fetchLatestOpenSessionsByChannelId,
	sessionPersistFieldsUnchanged,
} from './session-lifecycle';
import { shouldPromoteDiscoveredToTracked } from './live-sightings';
import type { SampleArchiveRow } from '../r2/sample-archive';
import { slugify, slugWithPlatformChannelFallback } from '../twitch/slug';
import type { KickCategory, KickLivestream } from '../kick/types';
import { batchRecordKickApiChannelIds } from '../kick/api-channel-id';
import { logD1Meta } from './d1-meta';
import {
	isKickViewerCountKnown,
	kickBroadcasterId,
	kickPlatformStreamId,
	kickSessionRowId,
	kickStreamSessionPersist,
} from '../kick/stream-fields';

const nowIso = () => new Date().toISOString();

type ExistingChannel = {
	id: string;
	slug: string;
	display_name: string;
	language: string | null;
	ingest_state: string;
	first_observed_at: string;
	platform_channel_id: string;
};

function channelNeedsFullUpsert(
	existing: ExistingChannel | undefined,
	slug: string,
	displayName: string,
	language: string | null,
	ingestState: string,
	recordSighting: boolean,
): boolean {
	if (!existing || recordSighting) return true;
	if (existing.slug !== slug) return true;
	if (existing.display_name !== displayName) return true;
	if ((existing.language ?? null) !== language) return true;
	if (existing.ingest_state !== ingestState) return true;
	return false;
}

async function fetchExistingKickChannels(db: D1Database, broadcasterIds: string[]): Promise<Map<string, ExistingChannel>> {
	const map = new Map<string, ExistingChannel>();
	if (broadcasterIds.length === 0) return map;

	for (const batch of chunkArray(broadcasterIds, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = batch.map(() => '?').join(', ');
		const { results } = await db
			.prepare(
				`SELECT id, slug, display_name, language, ingest_state, first_observed_at, platform_channel_id
         FROM channels
         WHERE platform_id = ? AND platform_channel_id IN (${placeholders})`,
			)
			.bind(PLATFORM_KICK, ...batch)
			.all<ExistingChannel>();

		for (const row of results ?? []) {
			map.set(row.platform_channel_id, row);
		}
	}
	return map;
}

async function fetchKickSlugOwners(db: D1Database, slugs: string[]): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	const unique = [...new Set(slugs.filter(Boolean))];
	if (unique.length === 0) return map;

	for (const batch of chunkArray(unique, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = batch.map(() => '?').join(', ');
		const { results } = await db
			.prepare(
				`SELECT slug, platform_channel_id FROM channels
         WHERE platform_id = ? AND slug IN (${placeholders})`,
			)
			.bind(PLATFORM_KICK, ...batch)
			.all<{ slug: string; platform_channel_id: string }>();

		for (const row of results ?? []) {
			map.set(row.slug, row.platform_channel_id);
		}
	}
	return map;
}

async function fetchOpenSessionsByChannelId(db: D1Database, channelIds: string[]) {
	return fetchLatestOpenSessionsByChannelId(db, channelIds);
}

async function fetchSightingCounts14d(db: D1Database, channelIds: string[]): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (channelIds.length === 0) return map;

	const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

	for (const batch of chunkArray(channelIds, D1_BATCH_MAX_STATEMENTS)) {
		const placeholders = batch.map(() => '?').join(', ');
		const { results } = await db
			.prepare(
				`SELECT channel_id, COUNT(*) AS n FROM channel_live_sightings
         WHERE channel_id IN (${placeholders}) AND sighted_at >= ?
         GROUP BY channel_id`,
			)
			.bind(...batch, windowStart)
			.all<{ channel_id: string; n: number }>();

		for (const row of results ?? []) {
			map.set(row.channel_id, row.n);
		}
	}
	return map;
}

const GAME_UPSERT_COLS = 5;

export async function batchUpsertKickGameCategories(
	db: D1Database,
	categories: Pick<KickCategory, 'id' | 'name'>[],
): Promise<Map<string, string>> {
	const byPlatformId = new Map<number, Pick<KickCategory, 'id' | 'name'>>();
	for (const cat of categories) {
		if (!Number.isFinite(cat.id)) continue;
		byPlatformId.set(cat.id, cat);
	}

	const map = new Map<string, string>();
	const entries = [...byPlatformId.entries()];
	if (entries.length === 0) return map;

	const rowCap = maxRowsPerInsert(GAME_UPSERT_COLS);

	for (const chunk of chunkArray(entries, rowCap)) {
		const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
		const binds: (string | number)[] = [];
		for (const [platformCategoryId, cat] of chunk) {
			const platformId = String(platformCategoryId);
			const slug = slugify(cat.name) || `game-${platformId}`;
			const id = `kick-game-${platformId}`;
			map.set(platformId, id);
			binds.push(id, PLATFORM_KICK, platformId, slug, cat.name);
		}
		await db
			.prepare(
				`INSERT INTO game_categories (id, platform_id, platform_category_id, slug, name)
         VALUES ${placeholders}
         ON CONFLICT(platform_id, platform_category_id) DO UPDATE SET
           name = excluded.name,
           slug = excluded.slug`,
			)
			.bind(...binds)
			.run();
	}

	return map;
}

export async function batchUpsertKickChannelsFromLivestreams(
	db: D1Database,
	streams: KickLivestream[],
	opts: {
		minViewers: number;
		promoteToTracked: boolean;
		/** Category/game directory top-N — promote discovered → tracked (docs/12) */
		directoryListing?: boolean;
	},
	batchOpts?: { env?: Env; scope?: string },
): Promise<Map<string, string>> {
	const channelIdByBroadcaster = new Map<string, string>();
	if (streams.length === 0) return channelIdByBroadcaster;

	const now = nowIso();
	const broadcasterIds = streams.map(kickBroadcasterId);
	const existingById = await fetchExistingKickChannels(db, broadcasterIds);

	const newSlugs: string[] = [];
	for (const stream of streams) {
		const bid = kickBroadcasterId(stream);
		if (!existingById.has(bid)) {
			newSlugs.push(slugify(stream.slug) || `user-${bid}`);
		}
	}
	const slugOwners = await fetchKickSlugOwners(db, newSlugs);

	const slugHistoryStatements: D1PreparedStatement[] = [];
	const channelUpsertStatements: D1PreparedStatement[] = [];
	const channelLastSeenStatements: D1PreparedStatement[] = [];
	const sightingStatements: D1PreparedStatement[] = [];
	const sightingChannelIds: string[] = [];

	for (const stream of streams) {
		const bid = kickBroadcasterId(stream);
		let slug = slugify(stream.slug) || `user-${bid}`;
		const id = `kick-ch-${bid}`;
		const existing = existingById.get(bid);
		const viewerCount = isKickViewerCountKnown(stream.viewer_count) ? stream.viewer_count : 0;

		if (!existing) {
			const owner = slugOwners.get(slug);
			if (owner && owner !== bid) {
				slug = slugWithPlatformChannelFallback(slug, bid);
			}
		}

		if (existing && existing.slug !== slug) {
			slugHistoryStatements.push(
				db
					.prepare(
						`INSERT INTO slug_history (channel_id, old_slug, new_slug, platform_id, changed_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(platform_id, old_slug) DO NOTHING`,
					)
					.bind(existing.id, existing.slug, slug, PLATFORM_KICK, now),
			);
		}

		let ingestState = existing?.ingest_state ?? 'discovered';
		let recordSighting = false;

		if (ingestState === 'retired') {
			// unchanged
		} else if (ingestState === 'tracked') {
			ingestState = 'tracked';
		} else if (opts.promoteToTracked && isKickViewerCountKnown(stream.viewer_count) && viewerCount >= opts.minViewers) {
			if (opts.directoryListing && ingestState === 'discovered') {
				ingestState = 'tracked';
			} else if (ingestState === 'dormant') {
				ingestState = 'tracked';
			} else {
				recordSighting = true;
			}
		}

		const firstObserved = existing?.first_observed_at ?? now;
		const language = stream.language ?? null;
		const channelId = existing?.id ?? id;
		channelIdByBroadcaster.set(bid, channelId);

		if (channelNeedsFullUpsert(existing, slug, stream.slug, language, ingestState, recordSighting)) {
			channelUpsertStatements.push(
				db
					.prepare(
						`INSERT INTO channels (
               id, platform_id, platform_channel_id, slug, display_name,
               first_observed_at, last_seen_at, ingest_state, language
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(platform_id, platform_channel_id) DO UPDATE SET
               slug = excluded.slug,
               display_name = excluded.display_name,
               last_seen_at = excluded.last_seen_at,
               language = excluded.language,
               ingest_state = CASE
                 WHEN channels.ingest_state = 'retired' THEN channels.ingest_state
                 WHEN excluded.ingest_state = 'tracked' THEN 'tracked'
                 ELSE channels.ingest_state
               END`,
					)
					.bind(channelId, PLATFORM_KICK, bid, slug, stream.slug, firstObserved, now, ingestState, language),
			);
		} else {
			channelLastSeenStatements.push(db.prepare(`UPDATE channels SET last_seen_at = ? WHERE id = ?`).bind(now, channelId));
		}

		if (recordSighting && isKickViewerCountKnown(stream.viewer_count)) {
			sightingChannelIds.push(channelId);
			sightingStatements.push(
				db
					.prepare(
						`INSERT INTO channel_live_sightings (channel_id, sighted_at, viewer_count)
             VALUES (?, ?, ?)
             ON CONFLICT(channel_id, sighted_at) DO NOTHING`,
					)
					.bind(channelId, now, stream.viewer_count),
			);
			sightingStatements.push(
				db
					.prepare(
						`DELETE FROM channel_live_sightings
             WHERE channel_id = ? AND sighted_at < ?`,
					)
					.bind(channelId, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
			);
		}
	}

	const kickApiChannelEntries = streams.map((stream) => ({
		broadcasterUserId: kickBroadcasterId(stream),
		channelId: stream.channel_id,
	}));

	await Promise.all([
		runD1Batches(db, slugHistoryStatements, {
			scope: batchOpts?.scope ? `${batchOpts.scope}:slug_history` : undefined,
			env: batchOpts?.env,
		}),
		runD1Batches(db, channelUpsertStatements, {
			scope: batchOpts?.scope ? `${batchOpts.scope}:channels` : undefined,
			env: batchOpts?.env,
		}),
		runD1Batches(db, channelLastSeenStatements, {
			scope: batchOpts?.scope ? `${batchOpts.scope}:channels:last_seen` : undefined,
			env: batchOpts?.env,
		}),
		batchRecordKickApiChannelIds(db, kickApiChannelEntries, {
			scope: batchOpts?.scope ? `${batchOpts.scope}:kick_api_channel_id` : undefined,
			env: batchOpts?.env,
		}),
	]);
	await runD1Batches(db, sightingStatements, {
		scope: batchOpts?.scope ? `${batchOpts.scope}:sightings` : undefined,
		env: batchOpts?.env,
	});

	if (sightingChannelIds.length > 0) {
		const counts = await fetchSightingCounts14d(db, sightingChannelIds);
		const promoteStatements: D1PreparedStatement[] = [];
		for (const channelId of sightingChannelIds) {
			const n = counts.get(channelId) ?? 0;
			if (shouldPromoteDiscoveredToTracked(n)) {
				promoteStatements.push(db.prepare(`UPDATE channels SET ingest_state = 'tracked' WHERE id = ?`).bind(channelId));
			}
		}
		await runD1Batches(db, promoteStatements, {
			scope: batchOpts?.scope ? `${batchOpts.scope}:promote` : undefined,
			env: batchOpts?.env,
		});
	}

	return channelIdByBroadcaster;
}

export type KickLiveSampleInput = {
	channelId: string;
	stream: KickLivestream;
	gameCategoryId: string | null;
};

async function insertViewerSamplesMultiRow(
	db: D1Database,
	rows: { sessionRowId: string; sampledAt: string; viewerCount: number }[],
	batchOpts?: { env?: Env; scope?: string },
): Promise<void> {
	if (rows.length === 0) return;
	const cols = 3;
	const rowCap = maxRowsPerInsert(cols);

	for (const chunk of chunkArray(rows, rowCap)) {
		const placeholders = chunk.map(() => '(?, ?, ?)').join(', ');
		const binds = chunk.flatMap((r) => [r.sessionRowId, r.sampledAt, r.viewerCount]);
		const result = await db
			.prepare(
				`INSERT INTO viewer_samples (stream_session_id, sampled_at, viewer_count)
         VALUES ${placeholders}
         ON CONFLICT(stream_session_id, sampled_at) DO NOTHING`,
			)
			.bind(...binds)
			.run();
		if (batchOpts?.env) {
			logD1Meta(batchOpts.scope ?? 'ingest:viewer_samples', result, batchOpts);
		}
	}
}

export async function batchRecordKickLiveSamples(
	db: D1Database,
	inputs: KickLiveSampleInput[],
	batchOpts?: { env?: Env; scope?: string },
): Promise<SampleArchiveRow[]> {
	if (inputs.length === 0) return [];

	const gamesNeedingUpsert: Pick<KickCategory, 'id' | 'name'>[] = [];
	for (const { stream, gameCategoryId } of inputs) {
		const cat = stream.category;
		if (cat?.id != null && !gameCategoryId) {
			gamesNeedingUpsert.push({ id: cat.id, name: cat.name?.trim() || 'Unknown' });
		}
	}
	const now = nowIso();
	const channelIds = inputs.map((i) => i.channelId);
	const [gameIdToCategoryId, openByChannel] = await Promise.all([
		batchUpsertKickGameCategories(db, gamesNeedingUpsert),
		fetchOpenSessionsByChannelId(db, channelIds),
	]);

	const sessionInsertStatements: D1PreparedStatement[] = [];
	const sessionUpdateStatements: D1PreparedStatement[] = [];
	const staleSessionCloses: { channelId: string; platformStreamId: string }[] = [];
	const sampleRows: { sessionRowId: string; sampledAt: string; viewerCount: number }[] = [];
	const archive: SampleArchiveRow[] = [];

	for (const { channelId, stream, gameCategoryId } of inputs) {
		if (!isKickViewerCountKnown(stream.viewer_count)) continue;

		const cat = stream.category;
		let resolvedGameCategoryId = gameCategoryId;
		if (cat?.id != null && !resolvedGameCategoryId) {
			resolvedGameCategoryId = gameIdToCategoryId.get(String(cat.id)) ?? null;
		}

		const platformStreamId = kickPlatformStreamId(stream);
		const sessionId = kickSessionRowId(stream);
		const sessionFields = kickStreamSessionPersist(stream);
		const openSession = openByChannel.get(channelId);

		let sessionRowId = openSession?.id ?? sessionId;

		if (openSession && openSession.platform_stream_id !== platformStreamId) {
			staleSessionCloses.push({ channelId, platformStreamId });
			openByChannel.delete(channelId);
			sessionRowId = sessionId;
		}

		if (!openSession || openSession.platform_stream_id !== platformStreamId) {
			sessionInsertStatements.push(
				db
					.prepare(
						`INSERT INTO stream_sessions (
               id, channel_id, platform_stream_id, title, game_category_id, started_at,
               language, tags_json, thumbnail_url, stream_type
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(channel_id, platform_stream_id) DO UPDATE SET
               title = excluded.title,
               game_category_id = excluded.game_category_id,
               language = excluded.language,
               tags_json = excluded.tags_json,
               thumbnail_url = excluded.thumbnail_url,
               stream_type = excluded.stream_type`,
					)
					.bind(
						sessionRowId,
						channelId,
						platformStreamId,
						stream.stream_title,
						resolvedGameCategoryId,
						stream.started_at,
						sessionFields.language,
						sessionFields.tags_json,
						sessionFields.thumbnail_url,
						sessionFields.stream_type,
					),
			);
		} else {
			const nextFields = {
				title: stream.stream_title,
				game_category_id: resolvedGameCategoryId,
				language: sessionFields.language,
				tags_json: sessionFields.tags_json,
				thumbnail_url: sessionFields.thumbnail_url,
				stream_type: sessionFields.stream_type,
			};
			if (!sessionPersistFieldsUnchanged(openSession, nextFields)) {
				sessionUpdateStatements.push(
					db
						.prepare(
							`UPDATE stream_sessions SET
               title = ?,
               game_category_id = ?,
               language = ?,
               tags_json = ?,
               thumbnail_url = ?,
               stream_type = ?
             WHERE id = ?`,
						)
						.bind(
							nextFields.title,
							nextFields.game_category_id,
							nextFields.language,
							nextFields.tags_json,
							nextFields.thumbnail_url,
							nextFields.stream_type,
							sessionRowId,
						),
				);
			}
		}

		sampleRows.push({
			sessionRowId,
			sampledAt: now,
			viewerCount: stream.viewer_count,
		});
		archive.push({
			stream_session_id: sessionRowId,
			sampled_at: now,
			viewer_count: stream.viewer_count,
			platform: 'kick',
		});
	}

	await batchCloseStaleOpenSessionsForChannels(db, staleSessionCloses, now, {
		scope: batchOpts?.scope ? `${batchOpts.scope}:stale_session_close` : undefined,
		env: batchOpts?.env,
	});
	await Promise.all([
		sessionInsertStatements.length > 0
			? runD1Batches(db, sessionInsertStatements, {
					scope: batchOpts?.scope ? `${batchOpts.scope}:session_insert` : undefined,
					env: batchOpts?.env,
				})
			: Promise.resolve(),
		sessionUpdateStatements.length > 0
			? runD1Batches(db, sessionUpdateStatements, {
					scope: batchOpts?.scope ? `${batchOpts.scope}:session_update` : undefined,
					env: batchOpts?.env,
				})
			: Promise.resolve(),
	]);
	await insertViewerSamplesMultiRow(db, sampleRows, {
		env: batchOpts?.env,
		scope: batchOpts?.scope ? `${batchOpts.scope}:viewer_samples` : undefined,
	});

	return archive;
}
