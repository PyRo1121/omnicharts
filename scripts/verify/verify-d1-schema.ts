#!/usr/bin/env bun
/**
 * D1 schema parity through migration 0009 (local or remote).
 * @see docs/13-testing-and-verification.md · migrations/d1/
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const INGEST_CWD = join(import.meta.dir, '../..', 'workers', 'ingest');
const DB = 'omnicharts';

const MIGRATION_FILES = [
	'0001_init_schema.sql',
	'0002_twitch_eventsub.sql',
	'0003_ingest_metadata_search.sql',
	'0004_helix_stream_fields.sql',
	'0005_channel_profile_helix.sql',
	'0006_channel_sightings_followers.sql',
	'0007_viewer_samples_sampled_at_index.sql',
	'0008_ingest_hot_path_indexes.sql',
	'0009_youtube_live_video_id.sql'
] as const;

/** Tables that must exist after migrations 0001–0009 (0001–0006 create/alter; 0007–0008 indexes; 0009 column). */
const EXPECTED_TABLES = [
	'platforms',
	'channels',
	'game_categories',
	'stream_sessions',
	'viewer_samples',
	'channel_daily_rollups',
	'game_daily_rollups',
	'slug_history',
	'twitch_eventsub_subscriptions',
	'ingest_metadata',
	'channel_live_sightings'
] as const;

/** Columns added or created in 0004–0006 (table → column names). */
const EXPECTED_COLUMNS: Record<string, string[]> = {
	channels: [
		'language',
		'description',
		'broadcaster_type',
		'platform_created_at',
		'channel_profile_json',
		'profile_enriched_at',
		'follower_count',
		'followers_enriched_at',
		'youtube_live_video_id'
	],
	stream_sessions: ['language', 'tags_json', 'thumbnail_url', 'stream_type'],
	channel_daily_rollups: ['followers_delta']
};

/** Indexes from migrations 0007–0008 (ingest hot-path / prune). */
const EXPECTED_INDEXES = [
	'idx_viewer_samples_sampled_at',
	'idx_channels_platform_state_seen',
	'idx_stream_sessions_channel_open'
] as const;

function usage(): never {
	console.error(`Usage: bun run scripts/verify/verify-d1-schema.ts [--remote]

Checks D1 tables/columns for migrations ${MIGRATION_FILES.join(', ')}.
Runs wrangler from workers/ingest (canonical migrate cwd).
`);
	process.exit(1);
}

function wranglerExecute(sql: string, remote: boolean): string {
	const args = [
		'd1',
		'execute',
		DB,
		'--command',
		sql,
		'--json',
		...(remote ? ['--remote'] : ['--local'])
	];
	const r = spawnSync('npx', ['wrangler', ...args], {
		cwd: INGEST_CWD,
		encoding: 'utf8',
		maxBuffer: 4 * 1024 * 1024
	});
	if (r.status !== 0) {
		throw new Error(
			`wrangler d1 execute failed (${remote ? 'remote' : 'local'}): ${r.stderr || r.stdout}`
		);
	}
	return r.stdout;
}

function parseJsonRows(stdout: string): Record<string, unknown>[] {
	const trimmed = stdout.trim();
	if (!trimmed) return [];
	try {
		const parsed = JSON.parse(trimmed) as
			| { results?: Record<string, unknown>[] }[]
			| { result?: { results?: Record<string, unknown>[] }[] }
			| Record<string, unknown>[];
		if (Array.isArray(parsed)) {
			if (parsed.length && parsed[0] && 'results' in parsed[0]) {
				return (parsed as { results?: Record<string, unknown>[] }[]).flatMap(
					(batch) => batch.results ?? []
				);
			}
			return parsed as Record<string, unknown>[];
		}
		const batch = parsed.result?.[0]?.results;
		return batch ?? [];
	} catch {
		throw new Error(`Could not parse wrangler JSON:\n${stdout.slice(0, 500)}`);
	}
}

function listTables(remote: boolean): Set<string> {
	const out = wranglerExecute(
		`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`,
		remote
	);
	const rows = parseJsonRows(out);
	return new Set(rows.map((r) => String(r.name ?? r.NAME ?? '')));
}

function tableColumns(table: string, remote: boolean): Set<string> {
	const out = wranglerExecute(`PRAGMA table_info(${table})`, remote);
	const rows = parseJsonRows(out);
	return new Set(rows.map((r) => String(r.name ?? r.NAME ?? '')));
}

function listIndexes(remote: boolean): Set<string> {
	const out = wranglerExecute(
		`SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
		remote
	);
	const rows = parseJsonRows(out);
	return new Set(rows.map((r) => String(r.name ?? r.NAME ?? '')));
}

function main() {
	const remote = process.argv.includes('--remote');
	const target = remote ? 'remote' : 'local';

	console.log(`D1 schema verify (${target}) — migrations 0001–0009\n`);
	console.log(`Migration files (SSOT): ${MIGRATION_FILES.join(', ')}\n`);

	const errors: string[] = [];
	const tables = listTables(remote);

	for (const t of EXPECTED_TABLES) {
		if (!tables.has(t)) errors.push(`missing table: ${t}`);
	}

	for (const [table, cols] of Object.entries(EXPECTED_COLUMNS)) {
		if (!tables.has(table)) continue;
		const have = tableColumns(table, remote);
		for (const col of cols) {
			if (!have.has(col)) errors.push(`missing column: ${table}.${col}`);
		}
	}

	const indexes = listIndexes(remote);
	for (const idx of EXPECTED_INDEXES) {
		if (!indexes.has(idx)) errors.push(`missing index: ${idx}`);
	}

	if (errors.length) {
		console.error('FAIL\n');
		for (const e of errors) console.error(`  - ${e}`);
		console.error(`\nApply migrations from workers/ingest:`);
		console.error(
			remote
				? '  bun run d1:migrate:remote'
				: '  bun run d1:migrate:local'
		);
		process.exit(1);
	}

	console.log(
		`PASS — ${EXPECTED_TABLES.length} tables, key columns through 0009, ${EXPECTED_INDEXES.length} indexes through 0008 (${target})`
	);
}

try {
	if (process.argv.includes('--help') || process.argv.includes('-h')) usage();
	main();
} catch (err) {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
}
