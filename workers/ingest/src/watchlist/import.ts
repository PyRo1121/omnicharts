import {
	PLATFORM_KICK,
	PLATFORM_TWITCH,
	PLATFORM_YOUTUBE,
	type PlatformId
} from '@omnicharts/domain';
import { hasTwitchAppCredentials } from '../twitch/credentials';
import { TwitchHelixClient } from '../twitch/helix';
import { KickPublicApiClient } from '../kick/api';
import { kickCredentialsConfigured } from '../kick/config';
import { ingestWarn } from '../log';
import { requireDb } from '../worker-bindings';
import { seedYoutubeChannelByQuery, youtubeSeedNeedsApiReason } from '../youtube/seed';
import { parseWatchlistCsv, type ParseWatchlistCsvResult, type WatchlistCsvRow } from './csv';
import { upsertKickChannelFromLookup, upsertTwitchChannelFromUser } from './upsert';

export type WatchlistImportRowStatus =
	| 'imported'
	| 'promoted'
	| 'skipped'
	| 'not_found'
	| 'needs_api'
	| 'error';

export type WatchlistImportRowResult = {
	line: number;
	platform: PlatformId;
	slug: string;
	status: WatchlistImportRowStatus;
	channel_id?: string;
	message?: string;
};

export type WatchlistImportStats = {
	ok: boolean;
	skipped: boolean;
	needs_api?: string | null;
	imported: number;
	promoted: number;
	skipped_rows: number;
	not_found: number;
	errors: number;
	parse_errors: number;
	parse: ParseWatchlistCsvResult;
	results: WatchlistImportRowResult[];
};

function twitchNeedsApiReason(env: Env): string | null {
	if (!hasTwitchAppCredentials(env)) {
		return 'TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET not configured';
	}
	return null;
}

function kickNeedsApiReason(env: Env): string | null {
	if (!kickCredentialsConfigured(env)) {
		return 'KICK_CLIENT_ID and KICK_CLIENT_SECRET not configured';
	}
	return null;
}

function emptyStats(parse: ParseWatchlistCsvResult): WatchlistImportStats {
	return {
		ok: false,
		skipped: false,
		needs_api: null,
		imported: 0,
		promoted: 0,
		skipped_rows: 0,
		not_found: 0,
		errors: 0,
		parse_errors: parse.errors.length,
		parse,
		results: []
	};
}

async function importTwitchRow(env: Env, row: WatchlistCsvRow): Promise<WatchlistImportRowResult> {
	const needsApi = twitchNeedsApiReason(env);
	if (needsApi) {
		return { line: row.line, platform: row.platform, slug: row.slug, status: 'needs_api', message: needsApi };
	}

	try {
		const client = new TwitchHelixClient(env);
		const users = await client.getUsersByLogins([row.slug]);
		const user = users.find((u) => u.login.toLowerCase() === row.slug) ?? users[0];
		if (!user) {
			return {
				line: row.line,
				platform: row.platform,
				slug: row.slug,
				status: 'not_found',
				message: 'Helix user not found'
			};
		}

		const upsert = await upsertTwitchChannelFromUser(requireDb(env), user);
		const status: WatchlistImportRowStatus = upsert.skipped
			? 'skipped'
			: upsert.promoted
				? 'promoted'
				: 'imported';

		return {
			line: row.line,
			platform: row.platform,
			slug: row.slug,
			status,
			channel_id: upsert.channelId
		};
	} catch (err) {
		ingestWarn('[watchlist] twitch import failed', row.slug, err);
		return {
			line: row.line,
			platform: row.platform,
			slug: row.slug,
			status: 'error',
			message: err instanceof Error ? err.message : 'import failed'
		};
	}
}

async function importKickRow(env: Env, row: WatchlistCsvRow): Promise<WatchlistImportRowResult> {
	const needsApi = kickNeedsApiReason(env);
	if (needsApi) {
		return { line: row.line, platform: row.platform, slug: row.slug, status: 'needs_api', message: needsApi };
	}

	try {
		const client = new KickPublicApiClient(env);
		const channels = await client.getChannelsBySlug(row.slug);
		const channel = channels.find((c) => c.slug.toLowerCase() === row.slug) ?? channels[0];
		if (!channel) {
			return {
				line: row.line,
				platform: row.platform,
				slug: row.slug,
				status: 'not_found',
				message: 'Kick channel not found'
			};
		}

		const upsert = await upsertKickChannelFromLookup(requireDb(env), channel);
		const status: WatchlistImportRowStatus = upsert.skipped
			? 'skipped'
			: upsert.promoted
				? 'promoted'
				: 'imported';

		return {
			line: row.line,
			platform: row.platform,
			slug: row.slug,
			status,
			channel_id: upsert.channelId
		};
	} catch (err) {
		ingestWarn('[watchlist] kick import failed', row.slug, err);
		return {
			line: row.line,
			platform: row.platform,
			slug: row.slug,
			status: 'error',
			message: err instanceof Error ? err.message : 'import failed'
		};
	}
}

async function importYoutubeRow(env: Env, row: WatchlistCsvRow): Promise<WatchlistImportRowResult> {
	const needsApi = youtubeSeedNeedsApiReason(env);
	if (needsApi) {
		return { line: row.line, platform: row.platform, slug: row.slug, status: 'needs_api', message: needsApi };
	}

	try {
		const db = requireDb(env);
		const existing = await db
			.prepare(
				`SELECT id, ingest_state FROM channels
         WHERE platform_id = ? AND lower(slug) = lower(?)`
			)
			.bind(PLATFORM_YOUTUBE, row.slug)
			.first<{ id: string; ingest_state: string }>();

		if (existing?.ingest_state === 'tracked') {
			return {
				line: row.line,
				platform: row.platform,
				slug: row.slug,
				status: 'skipped',
				channel_id: existing.id
			};
		}

		const wasDiscovered = Boolean(existing);
		const seeded = await seedYoutubeChannelByQuery(env, row.slug, { promoteToTracked: true });
		if (!seeded) {
			return {
				line: row.line,
				platform: row.platform,
				slug: row.slug,
				status: 'not_found',
				message: 'YouTube channel not found'
			};
		}

		return {
			line: row.line,
			platform: row.platform,
			slug: row.slug,
			status: wasDiscovered ? 'promoted' : 'imported',
			channel_id: seeded.id
		};
	} catch (err) {
		ingestWarn('[watchlist] youtube import failed', row.slug, err);
		return {
			line: row.line,
			platform: row.platform,
			slug: row.slug,
			status: 'error',
			message: err instanceof Error ? err.message : 'import failed'
		};
	}
}

export async function importWatchlistRows(
	env: Env,
	rows: WatchlistCsvRow[]
): Promise<WatchlistImportStats> {
	const parse: ParseWatchlistCsvResult = { rows, errors: [] };
	const results: WatchlistImportRowResult[] = [];
	const stats = emptyStats(parse);

	for (const row of rows) {
		let result: WatchlistImportRowResult;
		switch (row.platform) {
			case PLATFORM_TWITCH:
				result = await importTwitchRow(env, row);
				break;
			case PLATFORM_KICK:
				result = await importKickRow(env, row);
				break;
			case PLATFORM_YOUTUBE:
				result = await importYoutubeRow(env, row);
				break;
			default:
				result = {
					line: row.line,
					platform: row.platform,
					slug: row.slug,
					status: 'error',
					message: 'unsupported platform'
				};
		}
		results.push(result);

		switch (result.status) {
			case 'imported':
				stats.imported += 1;
				break;
			case 'promoted':
				stats.promoted += 1;
				break;
			case 'skipped':
				stats.skipped_rows += 1;
				break;
			case 'not_found':
				stats.not_found += 1;
				break;
			case 'needs_api':
				stats.needs_api = result.message ?? stats.needs_api;
				break;
			case 'error':
				stats.errors += 1;
				break;
		}
	}

	stats.results = results;
	stats.ok = stats.imported + stats.promoted + stats.skipped_rows > 0;
	stats.skipped = results.length > 0 && results.every((r) => r.status === 'needs_api');
	return stats;
}

export async function importWatchlistCsv(env: Env, csvText: string): Promise<WatchlistImportStats> {
	const parse = parseWatchlistCsv(csvText);
	if (parse.rows.length === 0) {
		return { ...emptyStats(parse), results: [] };
	}

	const stats = await importWatchlistRows(env, parse.rows);
	return { ...stats, parse };
}
