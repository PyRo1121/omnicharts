#!/usr/bin/env bun
/**
 * Kick Phase 3 verification — ingest unit tests + optional live discover checkpoint.
 *
 * Local full gate: `bun run dev:ingest` then `bun run verify:kick` (runs kick discover when
 * KICK_CLIENT_ID + KICK_CLIENT_SECRET in workers/ingest/.dev.vars).
 *
 * CI: VERIFY_SKIP_KICK_LIVE=1 or CI=true without VERIFY_KICK_FULL=1 skips live discover.
 *
 * @see docs/13-testing-and-verification.md · docs/adr/0003-kick-ingest-strategy.md
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '../..');
const DEV_VARS = join(REPO_ROOT, 'workers/ingest/.dev.vars');
const INGEST_BASE = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';
/** CI default: unit tests only. Set VERIFY_KICK_FULL=1 + ingest + KICK_* for live discover. */
const SKIP_LIVE =
	process.env.VERIFY_SKIP_KICK_LIVE === '1' ||
	(process.env.CI === 'true' && process.env.VERIFY_KICK_FULL !== '1');

type Step = { name: string; pass: boolean; detail: string };

const steps: Step[] = [];

function log(step: Step) {
	steps.push(step);
	const mark = step.pass ? 'PASS' : 'FAIL';
	console.log(`  [${mark}] ${step.name}: ${step.detail}`);
}

function run(cmd: string[], cwd = REPO_ROOT): Promise<{ ok: boolean; output: string }> {
	return new Promise((resolve) => {
		const proc = spawn(cmd[0]!, cmd.slice(1), { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		let output = '';
		proc.stdout?.on('data', (d) => {
			output += d.toString();
		});
		proc.stderr?.on('data', (d) => {
			output += d.toString();
		});
		proc.on('close', (code) => resolve({ ok: code === 0, output: output.trim() }));
	});
}

function readDevVar(name: string): string | undefined {
	if (!existsSync(DEV_VARS)) return undefined;
	for (const line of readFileSync(DEV_VARS, 'utf8').split('\n')) {
		const m = line.match(new RegExp(`^${name}=(.*)$`));
		if (m) return m[1]?.trim() || undefined;
	}
	return undefined;
}

function kickCredentialsConfigured(): boolean {
	const id = readDevVar('KICK_CLIENT_ID') ?? process.env.KICK_CLIENT_ID?.trim();
	const secret = readDevVar('KICK_CLIENT_SECRET') ?? process.env.KICK_CLIENT_SECRET?.trim();
	return Boolean(id && secret);
}

function adminApiKey(): string | undefined {
	const fromEnv = process.env.ADMIN_API_KEY?.trim();
	if (fromEnv) return fromEnv;
	return readDevVar('ADMIN_API_KEY');
}

async function ingestReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${INGEST_BASE}/health`, { signal: AbortSignal.timeout(3000) });
		return res.ok;
	} catch {
		return false;
	}
}

type RankingsGamesBody = {
	platform?: string;
	period?: string;
	updated_at?: string;
	items?: unknown;
};

function isValidRankingsGamesBody(body: RankingsGamesBody): boolean {
	return (
		typeof body.platform === 'string' &&
		typeof body.period === 'string' &&
		typeof body.updated_at === 'string' &&
		Array.isArray(body.items)
	);
}

async function kickRankingsGamesCheckpoint(): Promise<Step> {
	try {
		const res = await fetch(
			`${INGEST_BASE}/v1/rankings/games?platform=kick&period=7d&limit=5`,
			{ signal: AbortSignal.timeout(15_000) }
		);
		const body = (await res.json()) as RankingsGamesBody;
		if (!res.ok) {
			return {
				name: 'kick rankings games',
				pass: false,
				detail: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`
			};
		}
		if (!isValidRankingsGamesBody(body)) {
			return {
				name: 'kick rankings games',
				pass: false,
				detail: `invalid JSON shape: ${JSON.stringify(body).slice(0, 200)}`
			};
		}
		if (body.platform !== 'kick') {
			return {
				name: 'kick rankings games',
				pass: false,
				detail: `expected platform kick, got ${body.platform}`
			};
		}
		const count = body.items?.length ?? 0;
		return {
			name: 'kick rankings games',
			pass: true,
			detail:
				count > 0
					? `GET /v1/rankings/games ok — ${count} item(s)`
					: 'GET /v1/rankings/games ok — empty items (no rollups yet)'
		};
	} catch (err) {
		return {
			name: 'kick rankings games',
			pass: false,
			detail: err instanceof Error ? err.message : String(err)
		};
	}
}

async function kickDiscoverCheckpoint(): Promise<Step> {
	const key = adminApiKey();
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (key) headers['X-Admin-Api-Key'] = key;

	try {
		const res = await fetch(`${INGEST_BASE}/admin/kick/discover`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ quick: true }),
			signal: AbortSignal.timeout(120_000)
		});
		const body = (await res.json()) as { ok?: boolean; skipped?: boolean; stats?: unknown };
		if (!res.ok) {
			return {
				name: 'kick discover (quick)',
				pass: false,
				detail: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`
			};
		}
		if (body.skipped) {
			return {
				name: 'kick discover (quick)',
				pass: true,
				detail: 'NEEDS_API — KICK_CLIENT_ID/SECRET not configured in running ingest'
			};
		}
		return {
			name: 'kick discover (quick)',
			pass: body.ok === true,
			detail: `POST /admin/kick/discover ok — ${JSON.stringify(body.stats ?? {}).slice(0, 120)}`
		};
	} catch (err) {
		return {
			name: 'kick discover (quick)',
			pass: false,
			detail: err instanceof Error ? err.message : String(err)
		};
	}
}

async function main() {
	console.log('Kick verify (verify:kick)\n');

	const ingestTests = await run(['bun', 'run', 'test:ingest']);
	log({
		name: 'ingest unit tests',
		pass: ingestTests.ok,
		detail: ingestTests.ok ? 'vitest green' : ingestTests.output.slice(-400)
	});
	if (!ingestTests.ok) {
		printSummary();
		process.exit(1);
	}

	if (SKIP_LIVE) {
		const reachable = await ingestReachable();
		const creds = kickCredentialsConfigured();
		const skipDetail = reachable
			? creds
				? 'skipped (VERIFY_SKIP_KICK_LIVE or CI without VERIFY_KICK_FULL) — ingest was up'
				: 'skipped — no KICK_* in .dev.vars; unit tests only'
			: 'skipped — start dev:ingest for live discover; unit tests passed';
		log({
			name: 'kick discover (quick)',
			pass: true,
			detail: skipDetail
		});
		log({
			name: 'kick rankings games',
			pass: true,
			detail: skipDetail
		});
	} else if (!(await ingestReachable())) {
		log({
			name: 'ingest health',
			pass: false,
			detail: `ingest not reachable at ${INGEST_BASE} — start: bun run dev:ingest`
		});
		printSummary();
		process.exit(1);
	} else {
		const healthOk = await fetch(`${INGEST_BASE}/health`, { signal: AbortSignal.timeout(5000) });
		log({
			name: 'ingest health',
			pass: healthOk.ok,
			detail: healthOk.ok ? 'GET /health ok' : `HTTP ${healthOk.status}`
		});
		if (!healthOk.ok) {
			printSummary();
			process.exit(1);
		}

		const discover = await kickDiscoverCheckpoint();
		log(discover);
		if (!discover.pass) {
			printSummary();
			process.exit(1);
		}

		const games = await kickRankingsGamesCheckpoint();
		log(games);
		if (!games.pass) {
			printSummary();
			process.exit(1);
		}
	}

	printSummary();
	process.exit(steps.every((s) => s.pass) ? 0 : 1);
}

function printSummary() {
	const failed = steps.filter((s) => !s.pass);
	console.log(`\n${steps.length - failed.length}/${steps.length} steps passed`);
	if (failed.length) {
		console.log('Failed:', failed.map((s) => s.name).join(', '));
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
