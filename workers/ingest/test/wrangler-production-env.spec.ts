import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WRANGLER_PATH = join(import.meta.dirname, '../wrangler.jsonc');

type WranglerEnvBlock = {
	triggers?: { crons: string[] };
	vars?: Record<string, string>;
	limits?: { cpu_ms: number };
	queues?: { consumers: { max_batch_size: number; max_retries: number }[] };
};
type WranglerConfig = { env?: Record<string, WranglerEnvBlock> };

function isWranglerConfig(v: unknown): v is WranglerConfig {
	return typeof v === 'object' && v !== null;
}

function parseProductionVars(): Record<string, string> {
	const raw = readFileSync(WRANGLER_PATH, 'utf8');
	const productionBlock = raw.match(/"production"\s*:\s*\{[\s\S]*?"vars"\s*:\s*\{([\s\S]*?)\}/);
	if (!productionBlock) throw new Error('env.production.vars not found');
	const vars: Record<string, string> = {};
	for (const m of productionBlock[1].matchAll(/"([A-Z_]+)"\s*:\s*"([^"]*)"/g)) {
		vars[m[1]] = m[2];
	}
	return vars;
}

function parseProductionBlock(): WranglerEnvBlock {
	const raw = readFileSync(WRANGLER_PATH, 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/gm, '');
	const parsed: unknown = JSON.parse(raw);
	if (!isWranglerConfig(parsed)) {
		throw new Error('Invalid wrangler.jsonc');
	}
	const production = parsed.env?.production;
	if (!production) {
		throw new Error('env.production not found');
	}
	return production;
}

describe('wrangler production ranking thresholds', () => {
	it('sets Paid baked vars, minute cron, and archive off', () => {
		const vars = parseProductionVars();
		expect(vars.TWITCH_RANKING_MIN_AIRTIME_MINUTES).toBe('60');
		expect(vars.TWITCH_MIN_VIEWERS).toBe('20');
		expect(vars.ENVIRONMENT).toBe('production');
		expect(vars.INGEST_COVERAGE_MODE).toBe('full');
		expect(vars.TWITCH_MAX_TRACKED).toBe('3000');
		expect(vars.LIVE_SWEEP_MAX_PAGES).toBe('40');
		expect(vars.GAME_PASS_GAMES_PER_CYCLE).toBe('5');
		expect(vars.SAMPLE_ARCHIVE_ENABLED).toBe('0');
		expect(vars.SAMPLE_ARCHIVE_MIN_ROWS).toBe('10');
		const production = parseProductionBlock();
		expect(production.limits).toEqual({ cpu_ms: 30000 });
		expect(production.triggers).toEqual({
			crons: ['*/1 * * * *', '15 0 * * *', '0 */6 * * *'],
		});
	});
});
