import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WRANGLER_PATH = join(import.meta.dirname, '../wrangler.jsonc');

describe('wrangler staging free-tier profile', () => {
	it('uses */5 twitch cron and shards_only coverage', () => {
		const raw = readFileSync(WRANGLER_PATH, 'utf8');
		expect(raw).toContain('"staging"');
		expect(raw).toMatch(/"staging"[\s\S]*?"crons"\s*:\s*\[[\s\S]*?"\*\/5 \* \* \* \*"/);
		expect(raw).toMatch(/"staging"[\s\S]*?"INGEST_COVERAGE_MODE"\s*:\s*"shards_only"/);
		expect(raw).toMatch(/"staging"[\s\S]*?"TWITCH_MAX_TRACKED"\s*:\s*"200"/);
	});
});
