#!/usr/bin/env bun
/**
 * Twitch Phase 1 verification — unit coverage, web server loads, ingest health, build.
 *
 * Local full gate: `bun run dev:ingest` then `bun run verify:twitch` (runs twitch:checkpoint with
 * X-Admin-Api-Key from ADMIN_API_KEY or workers/ingest/.dev.vars).
 *
 * M1 operational proof (ingest must be up): `bun run twitch:freeze-proof` or
 * `bun run verify:twitch -- --proof-matrix` — health, d1:verify-schema, ingest:cron, checkpoint.
 *
 * CI: VERIFY_SKIP_CHECKPOINT=1 or CI=true without VERIFY_FULL=1 skips checkpoint.
 * Full CI: VERIFY_FULL=1 + ingest + TWITCH_* + ADMIN_API_KEY secrets.
 *
 * @see docs/13-testing-and-verification.md · docs/26-twitch-freeze-execution-plan.md
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import {
	EVENTSUB_SECRET_MIN_LENGTH,
	EVENTSUB_SECRET_MAX_LENGTH,
	isValidTwitchEventSubSecret
} from '../../workers/ingest/src/twitch/eventsub/secret';

const REPO_ROOT = join(import.meta.dir, '../..');
const DEV_VARS = join(REPO_ROOT, 'workers/ingest/.dev.vars');
const INGEST_BASE = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';
const PROOF_MATRIX = process.argv.includes('--proof-matrix');
/** CI default: unit tests + web only. Set VERIFY_FULL=1 + ingest + secrets for checkpoint. */
const SKIP_CHECKPOINT =
	process.env.VERIFY_SKIP_CHECKPOINT === '1' ||
	(process.env.CI === 'true' && process.env.VERIFY_FULL !== '1');

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

/** Prefer workers/ingest/.dev.vars — matches wrangler dev bindings (shell env can differ). */
function readEventSubSecret(): string | undefined {
	if (existsSync(DEV_VARS)) {
		const fromFile = readDevVar('TWITCH_EVENTSUB_SECRET');
		if (fromFile !== undefined) return fromFile;
	}
	return process.env.TWITCH_EVENTSUB_SECRET?.trim();
}

function readEventSubCallback(): string | undefined {
	if (existsSync(DEV_VARS)) {
		const fromFile = readDevVar('TWITCH_EVENTSUB_CALLBACK_URL');
		if (fromFile !== undefined) return fromFile;
	}
	return process.env.TWITCH_EVENTSUB_CALLBACK_URL?.trim();
}

/** Run EventSub local proof only when secret length is valid for Twitch Helix. */
function eventSubProofDetail(): { run: boolean; detail: string } {
	const secret = readEventSubSecret();
	const callback = readEventSubCallback();
	if (!secret && !callback) {
		return {
			run: false,
			detail:
				'skipped — set TWITCH_EVENTSUB_SECRET (min 10 chars) + TWITCH_EVENTSUB_CALLBACK_URL in workers/ingest/.dev.vars'
		};
	}
	if (!secret || !callback) {
		return {
			run: false,
			detail:
				'skipped — TWITCH_EVENTSUB_SECRET and TWITCH_EVENTSUB_CALLBACK_URL must both be set in workers/ingest/.dev.vars'
		};
	}
	if (!isValidTwitchEventSubSecret(secret)) {
		return {
			run: false,
			detail: `skipped — TWITCH_EVENTSUB_SECRET invalid (${secret.length} chars; Twitch requires ${EVENTSUB_SECRET_MIN_LENGTH}–${EVENTSUB_SECRET_MAX_LENGTH})`
		};
	}
	return { run: true, detail: '' };
}

async function ingestReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${INGEST_BASE}/health`, { signal: AbortSignal.timeout(3000) });
		return res.ok;
	} catch {
		return false;
	}
}

async function ingestHealthStep(): Promise<boolean> {
	if (!(await ingestReachable())) {
		log({
			name: 'ingest health',
			pass: false,
			detail: `not reachable at ${INGEST_BASE} — start: bun run dev:ingest`
		});
		return false;
	}
	let detail = 'GET /health ok';
	try {
		const res = await fetch(`${INGEST_BASE}/health`, { signal: AbortSignal.timeout(5000) });
		const raw = await res.text();
		const snippet = raw.slice(0, 120);
		detail = res.ok ? `GET /health ok (${snippet || 'empty body'})` : `HTTP ${res.status}`;
		if (!res.ok) {
			log({ name: 'ingest health', pass: false, detail });
			return false;
		}
		let parsed: { status?: string; db?: string } | null = null;
		try {
			parsed = JSON.parse(raw) as { status?: string; db?: string };
		} catch {
			log({ name: 'ingest health', pass: false, detail: 'invalid JSON from /health' });
			return false;
		}
		if (parsed.db !== 'connected') {
			log({
				name: 'ingest health',
				pass: false,
				detail: `db=${parsed.db ?? 'unknown'}`
			});
			return false;
		}
		if (parsed.status === 'degraded') {
			detail = `GET /health degraded (ingest lag) — ${snippet}`;
		} else if (parsed.status !== 'ok') {
			log({
				name: 'ingest health',
				pass: false,
				detail: `status=${parsed.status ?? 'unknown'} db=${parsed.db ?? 'unknown'}`
			});
			return false;
		}
	} catch (err) {
		log({
			name: 'ingest health',
			pass: false,
			detail: err instanceof Error ? err.message : String(err)
		});
		return false;
	}
	log({ name: 'ingest health', pass: true, detail });
	return true;
}

/** M1 local operational proof — requires dev:ingest with --test-scheduled. */
async function runProofMatrix(): Promise<void> {
	console.log('Twitch M1 freeze proof matrix (twitch:freeze-proof)\n');

	if (!(await ingestHealthStep())) {
		printSummary();
		process.exit(1);
	}

	const schema = await run(['bun', 'run', 'd1:verify-schema']);
	log({
		name: 'd1:verify-schema (local)',
		pass: schema.ok,
		detail: schema.ok ? 'migrations 0001–0009 tables/columns/indexes ok' : schema.output.slice(-500)
	});
	if (!schema.ok) {
		printSummary();
		process.exit(1);
	}

	const cron = await run(['bun', 'run', 'ingest:cron']);
	log({
		name: 'ingest:cron (*/1)',
		pass: cron.ok,
		detail: cron.ok ? 'scheduled handler ok' : cron.output.slice(-400)
	});
	if (!cron.ok) {
		printSummary();
		process.exit(1);
	}

	const checkpoint = await run(['bun', 'run', 'twitch:checkpoint', '--no-start-ingest']);
	log({
		name: 'twitch:checkpoint (--no-start-ingest)',
		pass: checkpoint.ok,
		detail: checkpoint.ok
			? 'pipeline ok (X-Admin-Api-Key from env / .dev.vars)'
			: checkpoint.output.slice(-500)
	});
	if (!checkpoint.ok) {
		printSummary();
		process.exit(1);
	}

	const eventSubProof = eventSubProofDetail();
	if (eventSubProof.run) {
		const eventsub = await run(['bun', 'run', 'twitch:eventsub-local-proof']);
		const skipped = /^\s*SKIP:/m.test(eventsub.output);
		log({
			name: 'twitch:eventsub-sync (local proof)',
			pass: eventsub.ok || skipped,
			detail: skipped
				? eventsub.output.split('\n').find((l) => l.includes('SKIP:'))?.trim() ??
					'skipped — EventSub secret invalid in running ingest'
				: eventsub.ok
					? 'POST /admin/twitch/eventsub/sync ok'
					: eventsub.output.slice(-500)
		});
	} else {
		log({
			name: 'twitch:eventsub-sync (local proof)',
			pass: true,
			detail: eventSubProof.detail
		});
	}

	printSummary();
	process.exit(steps.every((s) => s.pass) ? 0 : 1);
}

async function main() {
	if (PROOF_MATRIX) {
		await runProofMatrix();
		return;
	}

	console.log('Twitch verify (verify:twitch)\n');

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

	const coverage = await run(['bun', 'run', 'test:ingest:coverage']);
	log({
		name: 'ingest coverage (twitch/ + db/)',
		pass: coverage.ok,
		detail: coverage.ok ? '≥80% thresholds' : coverage.output.slice(-500)
	});
	if (!coverage.ok) {
		printSummary();
		process.exit(1);
	}

	const webTests = await run(['bun', 'run', 'test:web']);
	log({
		name: 'web server load tests',
		pass: webTests.ok,
		detail: webTests.ok ? 'vitest green' : webTests.output.slice(-400)
	});
	if (!webTests.ok) {
		printSummary();
		process.exit(1);
	}

	if (SKIP_CHECKPOINT) {
		const reachable = await ingestReachable();
		log({
			name: 'twitch checkpoint (--no-start-ingest)',
			pass: true,
			detail: reachable
				? 'skipped (VERIFY_SKIP_CHECKPOINT or CI without VERIFY_FULL) — ingest was up'
				: 'skipped — no Helix/local ingest in CI; run locally: bun run dev:ingest && bun run verify:twitch'
		});
	} else if (!(await ingestReachable())) {
		log({
			name: 'ingest health (checkpoint)',
			pass: false,
			detail: `ingest not reachable at ${INGEST_BASE} — start: bun run dev:ingest`
		});
		printSummary();
		process.exit(1);
	} else {
		const checkpoint = await run([
			'bun',
			'run',
			'twitch:checkpoint',
			'--no-start-ingest'
		]);
		log({
			name: 'twitch checkpoint (--no-start-ingest)',
			pass: checkpoint.ok,
			detail: checkpoint.ok ? 'pipeline ok' : checkpoint.output.slice(-500)
		});
		if (!checkpoint.ok) {
			printSummary();
			process.exit(1);
		}
	}

	const checkWeb = await run(['bun', 'run', 'check:web']);
	log({
		name: 'web check',
		pass: checkWeb.ok,
		detail: checkWeb.ok ? 'svelte-check ok' : checkWeb.output.slice(-400)
	});

	const buildWeb = await run(['bun', 'run', 'build:web']);
	log({
		name: 'web build',
		pass: buildWeb.ok,
		detail: buildWeb.ok ? 'vite build ok' : buildWeb.output.slice(-400)
	});

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
