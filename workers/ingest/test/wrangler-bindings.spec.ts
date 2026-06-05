import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WRANGLER_PATH = join(import.meta.dirname, '../wrangler.jsonc');

/** Strip comments so JSON.parse works on wrangler.jsonc */
function parseWrangler(): Record<string, unknown> {
	const raw = readFileSync(WRANGLER_PATH, 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/gm, '');
	return JSON.parse(raw) as Record<string, unknown>;
}

describe('wrangler ingest bindings (lane 4)', () => {
	const config = parseWrangler();

	it('sets compatibility_date and observability', () => {
		expect(config.compatibility_date).toBe('2026-06-01');
		expect(config.observability).toEqual({ enabled: true });
	});

	it('aliases @omnicharts workspace packages to package src', () => {
		expect(config.alias).toEqual({
			'@omnicharts/domain': '../../packages/domain/src/index.ts',
			'@omnicharts/rollup': '../../packages/rollup/src/index.ts'
		});
	});

	it('binds D1, R2 SAMPLES, and ingest queue', () => {
		const d1 = config.d1_databases as { binding: string }[];
		const r2 = config.r2_buckets as { binding: string }[];
		const queues = config.queues as { producers: { binding: string }[] };
		expect(d1[0]?.binding).toBe('DB');
		expect(r2[0]?.binding).toBe('SAMPLES');
		expect(queues.producers[0]?.binding).toBe('INGEST_QUEUE');
	});

	it('defaults consumer batch for Free-safe local deploy', () => {
		const consumers = (config.queues as { consumers: { max_batch_size: number; max_retries: number }[] })
			.consumers;
		expect(consumers[0]?.max_batch_size).toBe(5);
		expect(consumers[0]?.max_retries).toBe(2);
	});

	it('staging uses */5 twitch, */2 kick+youtube cron, and shards_only', () => {
		const staging = (config.env as Record<string, Record<string, unknown>>).staging;
		expect(staging.triggers).toEqual({
			crons: ['*/5 * * * *', '*/2 * * * *', '15 0 * * *', '0 */6 * * *']
		});
		expect((staging.vars as Record<string, string>).INGEST_COVERAGE_MODE).toBe('shards_only');
	});

	it('production sets cpu_ms 30000, */1 cron, and baked caps', () => {
		const production = (config.env as Record<string, Record<string, unknown>>).production;
		expect(production.limits).toEqual({ cpu_ms: 30000 });
		expect(production.triggers).toEqual({
			crons: ['*/1 * * * *', '15 0 * * *', '0 */6 * * *']
		});
		const consumers = (production.queues as { consumers: { max_batch_size: number; max_retries: number }[] })
			.consumers;
		expect(consumers[0]?.max_batch_size).toBe(3);
		expect(consumers[0]?.max_retries).toBe(3);
		const vars = production.vars as Record<string, string>;
		expect(vars.INGEST_COVERAGE_MODE).toBe('full');
		expect(vars.TWITCH_MAX_TRACKED).toBe('3000');
		expect(vars.LIVE_SWEEP_MAX_PAGES).toBe('40');
		expect(vars.GAME_PASS_GAMES_PER_CYCLE).toBe('5');
	});
});
