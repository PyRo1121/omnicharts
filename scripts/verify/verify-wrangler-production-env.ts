#!/usr/bin/env bun
/**
 * Deploy guard: production env must use ranking thresholds 60m airtime / 20 min AV.
 * @see docs/24-remediation-grounding-audit.md §8
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WRANGLER_PATH = join(import.meta.dirname, '../../workers/ingest/wrangler.jsonc');

function parseProductionVars(): Record<string, string> {
	const raw = readFileSync(WRANGLER_PATH, 'utf8');
	const productionBlock = raw.match(/"production"\s*:\s*\{[\s\S]*?"vars"\s*:\s*\{([\s\S]*?)\}/);
	if (!productionBlock) {
		console.error('env.production.vars not found in wrangler.jsonc');
		process.exit(1);
	}
	const vars: Record<string, string> = {};
	for (const m of productionBlock[1].matchAll(/"([A-Z_]+)"\s*:\s*"([^"]*)"/g)) {
		vars[m[1]] = m[2];
	}
	return vars;
}

const vars = parseProductionVars();
const expected: Record<string, string> = {
	ENVIRONMENT: 'production',
	TWITCH_RANKING_MIN_AIRTIME_MINUTES: '60',
	TWITCH_MIN_VIEWERS: '20',
};

let failed = false;
for (const [key, value] of Object.entries(expected)) {
	if (vars[key] !== value) {
		console.error(`[wrangler] env.production.vars.${key}: expected "${value}", got "${vars[key] ?? ''}"`);
		failed = true;
	}
}

if (failed) process.exit(1);
console.log('wrangler production env OK (60m airtime, 20 min viewers)');
