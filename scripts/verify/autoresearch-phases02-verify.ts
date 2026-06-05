#!/usr/bin/env bun
/**
 * Optional phases 0–2 bundle for foreground autoresearch agent loops (not a shipped gate).
 * Official gates: `bun run verify:twitch` · `bun run twitch:freeze-proof`.
 * Requires ingest up on 8787 — do NOT set VERIFY_SKIP_CHECKPOINT.
 *
 * Metrics 1–4 must pass in one sequential run for loop stop.
 * @see autoresearch-results/GOAL.md · docs/26-twitch-freeze-execution-plan.md
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '../..');
const INGEST_BASE = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';

type RunResult = { ok: boolean; output: string };

function run(cmd: string[], cwd = REPO_ROOT, env?: Record<string, string>): Promise<RunResult> {
	return new Promise((resolve) => {
		const proc = spawn(cmd[0]!, cmd.slice(1), {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env, ...env }
		});
		let output = '';
		proc.stdout?.on('data', (d) => {
			output += d.toString();
		});
		proc.stderr?.on('data', (d) => {
			output += d.toString();
		});
		proc.on('close', (code) => resolve({ ok: code === 0, output }));
	});
}

function countIssues(text: string): number {
	const lines = text.split('\n');
	let n = 0;
	for (const line of lines) {
		if (/^\s*Error:/.test(line) || /^\s*Warn:/.test(line)) n++;
	}
	return n;
}

function countWarnings(text: string): number {
	const lines = text.split('\n');
	let n = 0;
	for (const line of lines) {
		if (/^\s*Warn:/i.test(line) || /^\s*warning:/i.test(line)) n++;
	}
	return n;
}

function countTestNoise(text: string): number {
	const noisy =
		/\[vpw:(debug|info)\]/g.test(text) ||
		/\[mf:warn\]/g.test(text) ||
		/Using secrets defined in \.dev\.vars/.test(text);
	return noisy ? 1 : 0;
}

function parseSteps(output: string, defaultTotal: number): { passed: number; total: number; failed: number } {
	const m = output.match(/(\d+)\/(\d+) steps passed/);
	if (!m) return { passed: 0, total: defaultTotal, failed: defaultTotal };
	const passed = Number(m[1]);
	const total = Number(m[2]);
	return { passed, total, failed: total - passed };
}

async function ingestReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${INGEST_BASE}/health`, { signal: AbortSignal.timeout(3000) });
		return res.ok;
	} catch {
		return false;
	}
}

async function main() {
	const metrics: Record<string, number> = {};

	if (process.env.VERIFY_SKIP_CHECKPOINT === '1') {
		console.log('WARN: VERIFY_SKIP_CHECKPOINT=1 — full gate requires ingest + checkpoint');
	}

	if (!(await ingestReachable())) {
		console.log(`ingest health FAIL — start: bun run dev:ingest (${INGEST_BASE})`);
		metrics.ingest_up = 0;
	} else {
		metrics.ingest_up = 1;
		console.log(`ingest health PASS (${INGEST_BASE})`);
	}

	const checkWeb = await run(['bun', 'run', 'check:web']);
	metrics.check_web_issues = countIssues(checkWeb.output);
	metrics.lint_warnings = countWarnings(checkWeb.output);
	console.log(`check:web issues=${metrics.check_web_issues} ${checkWeb.ok ? 'PASS' : 'FAIL'}`);

	const checkIngest = await run(['bun', 'run', 'check:ingest']);
	metrics.check_ingest_issues = countIssues(checkIngest.output);
	metrics.check_ingest_warnings = countWarnings(checkIngest.output);
	console.log(
		`check:ingest issues=${metrics.check_ingest_issues} ${checkIngest.ok ? 'PASS' : 'FAIL'}`
	);

	const testIngest = await run(['bun', 'run', 'test:ingest']);
	metrics.test_ingest_failures = testIngest.ok ? 0 : 1;
	metrics.test_ingest_noise = countTestNoise(testIngest.output);
	console.log(
		`test:ingest ${testIngest.ok ? 'PASS' : 'FAIL'} noise=${metrics.test_ingest_noise}`
	);

	const testWeb = await run(['bun', 'run', 'test:web']);
	metrics.test_web_failures = testWeb.ok ? 0 : 1;
	metrics.test_web_noise = countTestNoise(testWeb.output);
	console.log(`test:web ${testWeb.ok ? 'PASS' : 'FAIL'} noise=${metrics.test_web_noise}`);

	const testE2e = await run(['bun', 'run', 'test:e2e']);
	metrics.test_e2e_failures = testE2e.ok ? 0 : 1;
	console.log(`test:e2e ${testE2e.ok ? 'PASS' : 'FAIL'}`);

	const verify = await run(['bun', 'run', 'verify:twitch'], REPO_ROOT, {
		VERIFY_SKIP_CHECKPOINT: '0'
	});
	const vt = parseSteps(verify.output, 6);
	metrics.verify_twitch_failed_steps = vt.failed;
	metrics.verify_twitch_passed_steps = vt.passed;
	console.log(`verify:twitch ${vt.passed}/${vt.total} ${verify.ok ? 'PASS' : 'FAIL'}`);
	if (!verify.ok) {
		const failed = [...verify.output.matchAll(/\[FAIL\]\s*([^:]+):/g)].map((m) => m[1]);
		if (failed.length) console.log(`  failed steps: ${failed.join(', ')}`);
	}

	const freeze = await run(['bun', 'run', 'twitch:freeze-proof']);
	const fp = parseSteps(freeze.output, 5);
	metrics.freeze_proof_failed_steps = fp.failed;
	metrics.freeze_proof_passed_steps = fp.passed;
	console.log(`twitch:freeze-proof ${fp.passed}/${fp.total} ${freeze.ok ? 'PASS' : 'FAIL'}`);

	const buildWeb = await run(['bun', 'run', 'build:web']);
	metrics.build_web_failures = buildWeb.ok ? 0 : 1;
	console.log(`build:web ${buildWeb.ok ? 'PASS' : 'FAIL'}`);

	let lighthouseOk = false;
	if (buildWeb.ok) {
		const lh = await run(['bun', 'run', 'lighthouse:smoke']);
		metrics.lighthouse_failures = lh.ok ? 0 : 1;
		lighthouseOk = lh.ok;
		console.log(`lighthouse:smoke ${lh.ok ? 'PASS' : 'FAIL'}`);
		if (!lh.ok) console.log(lh.output.slice(-600));
	} else {
		metrics.lighthouse_failures = 1;
		console.log('lighthouse:smoke SKIP (build failed)');
	}

	const wranglerProd = await run(['bun', 'run', 'verify:wrangler-production']);
	metrics.g3_wrangler_prod_failures = wranglerProd.ok ? 0 : 1;
	console.log(`G3 verify:wrangler-production ${wranglerProd.ok ? 'PASS' : 'FAIL'}`);

	metrics.total_failures =
		(metrics.ingest_up === 0 ? 1 : 0) +
		metrics.check_web_issues +
		metrics.check_ingest_issues +
		metrics.test_ingest_failures +
		metrics.test_web_failures +
		metrics.test_e2e_failures +
		metrics.verify_twitch_failed_steps +
		metrics.freeze_proof_failed_steps +
		metrics.build_web_failures +
		metrics.lighthouse_failures +
		metrics.g3_wrangler_prod_failures +
		(metrics.lint_warnings > 0 ? 1 : 0) +
		(metrics.check_ingest_warnings > 0 ? 1 : 0) +
		metrics.test_ingest_noise +
		metrics.test_web_noise;

	const payload = { primary_metric_key: 'total_failures', ...metrics };
	console.log(JSON.stringify(payload));

	const allOk =
		metrics.ingest_up === 1 &&
		checkWeb.ok &&
		checkIngest.ok &&
		testIngest.ok &&
		testWeb.ok &&
		testE2e.ok &&
		verify.ok &&
		freeze.ok &&
		buildWeb.ok &&
		lighthouseOk &&
		wranglerProd.ok &&
		metrics.total_failures === 0;

	process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
