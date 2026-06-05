import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { mockIngestD1, testEnv } from './helpers';
import type { HelixStream } from '../src/twitch/helix';
import { ingestHelixStream } from '../src/twitch/ingest-stream';
import { runDailyRollup } from '../src/rollup/daily-job';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const helixPayload: { data: HelixStream[] } = JSON.parse(
	readFileSync(join(fixtureDir, 'fixtures/helix-streams-sample.json'), 'utf8'),
);

const ROLLUP_DATE = new Date().toISOString().slice(0, 10);
const CHANNEL_ID = 'twitch-ch-545050196';
const SESSION_ID = 'open-sess';
const GAME_CATEGORY_ID = 'twitch-game-515025';

function fixtureStream(): HelixStream {
	const raw = helixPayload.data[0];
	if (!raw) throw new Error('missing helix fixture stream');
	return {
		...raw,
		user_login: 'kato_junichi0817',
		user_name: 'Kato',
		game_name: 'Just Chatting',
		viewer_count: 100,
		started_at: `${ROLLUP_DATE}T10:00:00.000Z`,
	};
}

function createHelixToRollupDb() {
	const rawSamples: unknown[][] = [];
	const channelRollups: unknown[][] = [];

	const db = mockIngestD1(
		(sql) => {
			if (sql.includes('platform_channel_id IN')) {
				return { bind: () => ({ all: async () => ({ results: [] }) }) };
			}
			if (sql.includes('slug IN')) {
				return { bind: () => ({ all: async () => ({ results: [] }) }) };
			}
			if (sql.includes('GROUP BY channel_id')) {
				return { bind: () => ({ all: async () => ({ results: [] }) }) };
			}
			if (sql.includes('INSERT INTO channel_live_sightings')) {
				return { bind: () => ({ run: async () => ({}) }) };
			}
			if (sql.includes('DELETE FROM channel_live_sightings')) {
				return { bind: () => ({ run: async () => ({}) }) };
			}
			if (sql.includes('FROM channel_live_sightings')) {
				return { bind: () => ({ first: async () => ({ n: 0 }) }) };
			}
			if (sql.includes('INSERT INTO channels')) {
				return { bind: () => ({ run: async () => ({}) }) };
			}
			if (sql.includes('SELECT id FROM channels WHERE')) {
				return { bind: () => ({ first: async () => ({ id: CHANNEL_ID }) }) };
			}
			if (sql.includes('FROM stream_sessions') && sql.includes('ended_at IS NULL')) {
				return {
					bind: () => ({
						first: async () => null,
						all: async () => ({ results: [] }),
					}),
				};
			}
			if (sql.includes('INSERT INTO stream_sessions')) {
				return { bind: () => ({ run: async () => ({}) }) };
			}
			if (sql.includes('UPDATE stream_sessions SET')) {
				return { bind: () => ({ run: async () => ({}) }) };
			}
			if (sql.includes('INSERT INTO viewer_samples')) {
				return {
					bind: (...args: unknown[]) => {
						rawSamples.push(args);
						return { run: async () => ({}) };
					},
				};
			}
			if (sql.includes('game_categories')) {
				return { bind: () => ({ run: async () => ({}) }) };
			}
			if (sql.includes('FROM viewer_samples') && sql.includes('SELECT vs')) {
				const rollupRows = rawSamples.map((args) => ({
					sampled_at: String(args[1]),
					viewer_count: Number(args[2]),
					session_id: SESSION_ID,
					channel_id: CHANNEL_ID,
					game_category_id: GAME_CATEGORY_ID,
				}));
				return {
					bind: () => ({
						all: async () => ({ results: rollupRows }),
					}),
				};
			}
			if (sql.includes('DELETE FROM viewer_samples')) {
				return { bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) };
			}
			if (sql.includes('SELECT id, follower_count FROM channels')) {
				return {
					bind: () => ({
						all: async () => ({ results: [{ id: CHANNEL_ID, follower_count: 1000 }] }),
					}),
				};
			}
			if (sql.includes('SELECT key, value FROM ingest_metadata')) {
				return { bind: () => ({ all: async () => ({ results: [] }) }) };
			}
			if (sql.includes('INSERT INTO channel_daily_rollups')) {
				return {
					bind: (...args: unknown[]) => {
						channelRollups.push(args);
						return { run: async () => ({}) };
					},
				};
			}
			if (sql.includes('INSERT INTO game_daily_rollups')) {
				return { bind: () => ({ run: async () => ({}) }) };
			}
			if (sql.includes('ingest_metadata')) {
				return { bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) };
			}
			if (sql.includes("ingest_state = 'dormant'")) {
				return { bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) };
			}
			return {
				bind: () => ({ run: async () => ({}), first: async () => null, all: async () => ({}) }),
			};
		},
		async (statements) => {
			const results = [];
			for (const stmt of statements) {
				results.push(await stmt.run());
			}
			return results;
		},
	);

	return { db, rawSamples, channelRollups };
}

describe('Helix fixture → ingest → rollup', () => {
	it('ingest records viewer_samples and rollup writes channel_daily_rollup', async () => {
		const { db, rawSamples, channelRollups } = createHelixToRollupDb();
		const env = testEnv({ DB: db });

		await ingestHelixStream(env, fixtureStream(), 20);

		expect(rawSamples).toHaveLength(1);
		expect(rawSamples[0]?.[2]).toBe(100);

		const stats = await runDailyRollup(env, ROLLUP_DATE);
		expect(stats.channelsProcessed).toBe(1);
		expect(channelRollups).toHaveLength(1);
		expect(channelRollups[0]?.[0]).toBe(CHANNEL_ID);
		expect(Number(channelRollups[0]?.[2])).toBeGreaterThan(0);
	});
});
