import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { mockIngestD1, testEnv } from './helpers';
import { parseHelixListResponse, parseHelixStream } from '../src/json-guards';
import type { HelixStream } from '../src/twitch/helix';
import { helixStreamSessionPersist, helixTagsJson } from '../src/twitch/stream-fields';
import { recordLiveSample, upsertChannelFromStream } from '../src/db/twitch';
import { ingestHelixStream } from '../src/twitch/ingest-stream';

const fixtureDir = dirname(fileURLToPath(import.meta.url));

function loadFixtureStream(): HelixStream {
	const raw: unknown = JSON.parse(readFileSync(join(fixtureDir, 'fixtures/helix-streams-sample.json'), 'utf8'));
	const list = parseHelixListResponse(raw);
	const stream = parseHelixStream(list.data[0]);
	if (!stream) throw new Error('missing helix stream fixture');
	return stream;
}

const sampleStream = (): HelixStream => ({
	...loadFixtureStream(),
	user_login: 'kato_junichi0817',
	user_name: 'Kato',
	game_name: 'Just Chatting',
	title: 'Live title',
});

describe('helix stream field mapping', () => {
	it('serializes tags to JSON', () => {
		expect(helixTagsJson(undefined)).toBeNull();
		expect(helixTagsJson([])).toBeNull();
		expect(helixTagsJson(['日本語', 'Drops有効'])).toBe(JSON.stringify(['日本語', 'Drops有効']));
	});

	it('maps fixture stream to session persist shape', () => {
		const stream = sampleStream();
		expect(helixStreamSessionPersist(stream)).toEqual({
			language: 'ja',
			tags_json: JSON.stringify(['日本語', 'Drops有効']),
			thumbnail_url: stream.thumbnail_url,
			stream_type: 'live',
		});
		expect(helixStreamSessionPersist(stream).language).toBe('ja');
	});

	it('omits optional fields when absent on wire', () => {
		const minimal: HelixStream = {
			id: '1',
			user_id: '2',
			user_login: 'x',
			user_name: 'X',
			game_id: '3',
			game_name: 'G',
			title: 'T',
			viewer_count: 10,
			started_at: '2026-06-01T00:00:00Z',
			type: 'live',
		};
		expect(helixStreamSessionPersist(minimal)).toEqual({
			language: null,
			tags_json: null,
			thumbnail_url: null,
			stream_type: 'live',
		});
	});
});

function createChannelDbMock(opts: { existingChannel?: boolean; openSession?: boolean; sightingCount?: number; ingestState?: string }) {
	const channelUpserts: unknown[][] = [];
	const sessionWrites: { sql: string; args: unknown[] }[] = [];
	const viewerSamples: unknown[][] = [];
	let sightings = opts.sightingCount ?? 0;

	const db = mockIngestD1(
		(sql) => {
			if (sql.includes('platform_channel_id IN')) {
				return {
					bind: () => ({
						all: async () =>
							opts.existingChannel
								? {
										results: [
											{
												id: 'twitch-ch-545050196',
												slug: 'kato_junichi0817',
												ingest_state: opts.ingestState ?? 'discovered',
												first_observed_at: '2026-05-01T00:00:00Z',
												platform_channel_id: '545050196',
											},
										],
									}
								: { results: [] },
					}),
				};
			}
			if (sql.includes('slug IN')) {
				return {
					bind: () => ({
						all: async () => ({ results: [] }),
					}),
				};
			}
			if (sql.includes('GROUP BY channel_id')) {
				return {
					bind: () => ({
						all: async () => ({
							results: sightings > 0 ? [{ channel_id: 'twitch-ch-545050196', n: sightings }] : [],
						}),
					}),
				};
			}
			if (sql.includes('INSERT INTO channel_live_sightings')) {
				return {
					bind: () => ({
						run: async () => {
							sightings++;
							return {};
						},
					}),
				};
			}
			if (sql.includes('DELETE FROM channel_live_sightings')) {
				return { bind: () => ({ run: async () => ({}) }) };
			}
			if (sql.includes('FROM channel_live_sightings') && sql.includes('COUNT')) {
				return {
					bind: () => ({
						first: async () => ({ n: sightings }),
						all: async () => ({
							results: sightings > 0 ? [{ channel_id: 'twitch-ch-545050196', n: sightings }] : [],
						}),
					}),
				};
			}
			if (sql.includes('INSERT INTO channels')) {
				return {
					bind: (...args: unknown[]) => {
						channelUpserts.push(args);
						return { run: async () => ({}) };
					},
				};
			}
			if (sql.includes('SELECT id FROM channels WHERE')) {
				return {
					bind: () => ({
						first: async () => ({ id: 'twitch-ch-545050196' }),
					}),
				};
			}
			if (sql.includes('FROM stream_sessions') && sql.includes('ended_at IS NULL')) {
				return {
					bind: () => ({
						first: async () => (opts.openSession ? { id: 'open-sess' } : null),
						all: async () =>
							opts.openSession
								? {
										results: [
											{
												id: 'open-sess',
												channel_id: 'twitch-ch-545050196',
												platform_stream_id: sampleStream().id,
												started_at: '2026-05-01T00:00:00Z',
											},
										],
									}
								: { results: [] },
					}),
				};
			}
			if (sql.includes('INSERT INTO stream_sessions')) {
				return {
					bind: (...args: unknown[]) => {
						sessionWrites.push({ sql, args });
						return { run: async () => ({}) };
					},
				};
			}
			if (sql.includes('UPDATE stream_sessions SET')) {
				return {
					bind: (...args: unknown[]) => {
						sessionWrites.push({ sql, args });
						return { run: async () => ({}) };
					},
				};
			}
			if (sql.includes('INSERT INTO viewer_samples')) {
				return {
					bind: (...args: unknown[]) => {
						viewerSamples.push(args);
						return { run: async () => ({}) };
					},
				};
			}
			if (sql.includes('game_categories')) {
				return {
					bind: () => ({ run: async () => ({}) }),
				};
			}
			return {
				bind: () => ({ run: async () => ({}), first: async () => null, all: async () => ({}) }),
			};
		},
		async (statements) => {
			await Promise.all(statements.map((stmt) => stmt.run()));
			return [];
		},
	);

	return { db, channelUpserts, sessionWrites, viewerSamples };
}

describe('Helix stream → D1', () => {
	it('upsertChannelFromStream binds language', async () => {
		const { db, channelUpserts } = createChannelDbMock({});
		await upsertChannelFromStream(db, sampleStream(), {
			minViewers: 0,
			promoteToTracked: false,
		});
		const upsert = channelUpserts[0];
		expect(upsert).toHaveLength(9);
		expect(upsert?.[8]).toBe('ja');
	});

	it('keeps discovered after first qualifying live sighting', async () => {
		const { db, channelUpserts } = createChannelDbMock({ existingChannel: true });
		const stream = { ...sampleStream(), viewer_count: 500 };
		await upsertChannelFromStream(db, stream, {
			minViewers: 20,
			promoteToTracked: true,
		});
		expect(channelUpserts[0]?.[7]).toBe('discovered');
	});

	it('promotes discovered to tracked after second sighting in 14d', async () => {
		const { db, channelUpserts } = createChannelDbMock({
			existingChannel: true,
			sightingCount: 1,
		});
		const stream = { ...sampleStream(), viewer_count: 500 };
		await upsertChannelFromStream(db, stream, {
			minViewers: 20,
			promoteToTracked: true,
		});
		expect(channelUpserts[0]?.[7]).toBe('discovered');
	});

	it('promotes dormant to tracked on qualifying live', async () => {
		const { db, channelUpserts } = createChannelDbMock({
			existingChannel: true,
			ingestState: 'dormant',
		});
		await upsertChannelFromStream(
			db,
			{ ...sampleStream(), viewer_count: 500 },
			{
				minViewers: 20,
				promoteToTracked: true,
			},
		);
		expect(channelUpserts[0]?.[7]).toBe('tracked');
	});

	it('ingestHelixStream records sample when viewers meet threshold', async () => {
		const { db, sessionWrites, viewerSamples } = createChannelDbMock({ openSession: false });
		const env = testEnv({ DB: db });
		await ingestHelixStream(env, { ...sampleStream(), viewer_count: 100 }, 20);
		expect(sessionWrites.length).toBeGreaterThan(0);
		expect(viewerSamples.length).toBe(1);
	});

	it('ingestHelixStream skips viewer sample below min viewers', async () => {
		const { db, viewerSamples } = createChannelDbMock({ openSession: false });
		const env = testEnv({ DB: db });
		await ingestHelixStream(env, { ...sampleStream(), viewer_count: 5 }, 20);
		expect(viewerSamples.length).toBe(0);
	});

	it('recordLiveSample inserts helix session fields on new session', async () => {
		const { db, sessionWrites } = createChannelDbMock({ openSession: false });
		const stream = sampleStream();
		await recordLiveSample(db, 'twitch-ch-545050196', stream, 'game-1');

		expect(sessionWrites).toHaveLength(1);
		const write = sessionWrites[0];
		expect(write?.sql).toContain('tags_json');
		const args = write?.args;
		expect(args[6]).toBe('ja');
		expect(args[7]).toBe(JSON.stringify(['日本語', 'Drops有効']));
		expect(args[8]).toContain('previews-ttv');
		expect(args[9]).toBe('live');
	});

	it('recordLiveSample updates helix session fields on open session', async () => {
		const { db, sessionWrites } = createChannelDbMock({ openSession: true });
		await recordLiveSample(db, 'twitch-ch-545050196', sampleStream(), null);

		const update = sessionWrites[0];
		expect(update?.sql).toContain('UPDATE stream_sessions');
		const args = update?.args;
		expect(args[2]).toBe('ja');
		expect(args[3]).toBe(JSON.stringify(['日本語', 'Drops有効']));
	});
});
