#!/usr/bin/env bun
/**
 * YouTube ingest verify — unit tests + optional API shape check when ingest is up.
 *
 * Full gate (discover cron, non-empty rankings) deferred — poll + live video id writer ship in ingest.
 *
 * Local: `bun run dev:ingest` then `bun run verify:youtube`
 * CI: always runs `test:ingest`; live check skipped when ingest unreachable or `VERIFY_SKIP_YOUTUBE_LIVE=1`.
 *
 * @see docs/13-testing-and-verification.md · docs/05-ingestion-per-platform.md
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '../..');
const INGEST_BASE = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';
const SKIP_LIVE =
	process.env.VERIFY_SKIP_YOUTUBE_LIVE === '1' ||
	(process.env.CI === 'true' && process.env.VERIFY_YOUTUBE_FULL !== '1');

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

async function ingestReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${INGEST_BASE}/health`, { signal: AbortSignal.timeout(3000) });
		return res.ok;
	} catch {
		return false;
	}
}

type RankingsBody = {
	platform?: string;
	period?: string;
	updated_at?: string;
	items?: unknown;
};

function isValidRankingsBody(body: RankingsBody): boolean {
	return (
		typeof body.platform === 'string' &&
		typeof body.period === 'string' &&
		typeof body.updated_at === 'string' &&
		Array.isArray(body.items)
	);
}

async function youtubeRankingsShapeCheckpoint(): Promise<Step> {
	try {
		const res = await fetch(
			`${INGEST_BASE}/v1/rankings/channels?platform=youtube&period=7d&limit=5`,
			{ signal: AbortSignal.timeout(15_000) }
		);
		const body = (await res.json()) as RankingsBody;
		if (!res.ok) {
			return {
				name: 'youtube rankings shape',
				pass: false,
				detail: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`
			};
		}
		if (!isValidRankingsBody(body) || body.platform !== 'youtube') {
			return {
				name: 'youtube rankings shape',
				pass: false,
				detail: `invalid JSON: ${JSON.stringify(body).slice(0, 200)}`
			};
		}
		const count = body.items?.length ?? 0;
		return {
			name: 'youtube rankings shape',
			pass: true,
			detail:
				count === 0
					? 'GET /v1/rankings/channels ok — empty items (expected until ingest ships)'
					: `GET /v1/rankings/channels ok — ${count} item(s) (ingest may be live)`
		};
	} catch (err) {
		return {
			name: 'youtube rankings shape',
			pass: false,
			detail: err instanceof Error ? err.message : String(err)
		};
	}
}

async function main() {
	console.log('YouTube verify (verify:youtube)\n');

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
		log({
			name: 'youtube rankings shape',
			pass: true,
			detail: 'skipped (VERIFY_SKIP_YOUTUBE_LIVE or CI without VERIFY_YOUTUBE_FULL)'
		});
	} else if (!(await ingestReachable())) {
		log({
			name: 'youtube rankings shape',
			pass: true,
			detail: `skipped — ingest not reachable at ${INGEST_BASE}`
		});
	} else {
		const shape = await youtubeRankingsShapeCheckpoint();
		log(shape);
		if (!shape.pass) {
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
