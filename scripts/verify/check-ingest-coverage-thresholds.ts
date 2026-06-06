#!/usr/bin/env bun
/**
 * Enforces ≥80% coverage on gated ingest paths (vitest per-glob thresholds are unreliable in 3.2.x).
 * @see workers/ingest/vitest.unit.config.mts · docs/13-testing-and-verification.md
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCoverageFinal, readNumberArrayRecord, readNumberRecord, readStatementMap } from '../lib/json-guards';

const INGEST_ROOT = join(import.meta.dir, '../..', 'workers', 'ingest');
const COVERAGE_JSON = join(INGEST_ROOT, 'coverage', 'coverage-final.json');

const THRESHOLD = 80;

const GATED_GLOBS = ['src/twitch/', 'src/db/', 'src/kick/', 'src/youtube/', 'src/r2/', 'src/watchlist/'] as const;

type Metric = 'lines' | 'statements' | 'functions' | 'branches';

type Totals = Record<Metric, { covered: number; total: number }>;

function emptyTotals(): Totals {
	return {
		lines: { covered: 0, total: 0 },
		statements: { covered: 0, total: 0 },
		functions: { covered: 0, total: 0 },
		branches: { covered: 0, total: 0 },
	};
}

function pct(t: { covered: number; total: number }): number {
	return t.total === 0 ? 100 : (100 * t.covered) / t.total;
}

function mergeFileTotals(into: Totals, file: Record<string, unknown>): void {
	const statements = readNumberRecord(file, 's');
	if (statements) {
		for (const hit of Object.values(statements)) {
			into.statements.total += 1;
			if (hit > 0) into.statements.covered += 1;
		}
	}

	const functions = readNumberRecord(file, 'f');
	if (functions) {
		for (const hit of Object.values(functions)) {
			into.functions.total += 1;
			if (hit > 0) into.functions.covered += 1;
		}
	}

	const branches = readNumberArrayRecord(file, 'b');
	if (branches) {
		for (const hits of Object.values(branches)) {
			for (const hit of hits) {
				into.branches.total += 1;
				if (hit > 0) into.branches.covered += 1;
			}
		}
	}

	const statementMap = readStatementMap(file, 'statementMap');
	const stmtHits = readNumberRecord(file, 's');
	if (statementMap && stmtHits) {
		const lineHits = new Map<number, boolean>();
		for (const [id, hit] of Object.entries(stmtHits)) {
			const line = statementMap[id]?.start?.line;
			if (line == null) continue;
			lineHits.set(line, (lineHits.get(line) ?? false) || hit > 0);
		}
		for (const covered of lineHits.values()) {
			into.lines.total += 1;
			if (covered) into.lines.covered += 1;
		}
	}
}

function main(): number {
	if (!existsSync(COVERAGE_JSON)) {
		console.error(`Missing ${COVERAGE_JSON} — run vitest with --coverage first`);
		return 1;
	}

	const raw = parseCoverageFinal(JSON.parse(readFileSync(COVERAGE_JSON, 'utf8')));
	if (!raw) {
		console.error(`Invalid coverage JSON at ${COVERAGE_JSON}`);
		return 1;
	}
	const prefix = `${INGEST_ROOT}/`;

	const byGlob = new Map<string, Totals>();
	for (const glob of GATED_GLOBS) {
		byGlob.set(glob, emptyTotals());
	}

	for (const [absPath, entry] of Object.entries(raw)) {
		const rel = absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
		const glob = GATED_GLOBS.find((g) => rel.startsWith(g));
		if (!glob) continue;
		if (rel.endsWith('/types.ts') || rel.endsWith('types.ts')) continue;
		if (rel === 'src/db/d1-meta.ts') continue;
		mergeFileTotals(byGlob.get(glob)!, entry);
	}

	let failed = false;
	console.log('Ingest coverage gates (≥80% lines/branches/functions/statements):\n');

	for (const glob of GATED_GLOBS) {
		const totals = byGlob.get(glob)!;
		const metrics: Metric[] = ['lines', 'statements', 'functions', 'branches'];
		const parts: string[] = [];
		for (const metric of metrics) {
			const p = pct(totals[metric]);
			parts.push(`${metric} ${p.toFixed(1)}%`);
			if (p < THRESHOLD) failed = true;
		}
		const status = parts.every((part) => {
			const value = Number.parseFloat(part.split(' ')[1]);
			return value >= THRESHOLD;
		})
			? 'PASS'
			: 'FAIL';
		console.log(`  [${status}] ${glob} — ${parts.join(', ')}`);
	}

	if (failed) {
		console.error('\nCoverage below 80% on one or more gated paths.');
		return 1;
	}

	console.log('\nAll gated coverage paths meet ≥80%.');
	return 0;
}

process.exit(main());
