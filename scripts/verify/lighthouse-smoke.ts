#!/usr/bin/env bun
/**
 * Lighthouse smoke after `bun run build:web`. Starts preview, audits `/`, fails on bad perf budget.
 * @see docs/audits/web-performance.md
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '../..');
const WEB_DIR = join(REPO_ROOT, 'apps/web');
const ARTIFACT_ROOT = join(REPO_ROOT, 'autoresearch-results');
const PREVIEW_URL = process.env.LIGHTHOUSE_URL ?? 'http://127.0.0.1:4173/';
const PREVIEW_PORT = 4173;
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/chromium';

/** Web perf budgets — fail loop if performance misses badly. */
const BUDGETS = {
	performance: Number(process.env.LH_MIN_PERFORMANCE ?? '75'),
	accessibility: Number(process.env.LH_MIN_ACCESSIBILITY ?? '90'),
	'best-practices': Number(process.env.LH_MIN_BEST_PRACTICES ?? '90'),
	seo: Number(process.env.LH_MIN_SEO ?? '90')
} as const;

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
		proc.on('close', (code) => resolve({ ok: code === 0, output }));
	});
}

async function waitForUrl(url: string, ms = 60_000): Promise<boolean> {
	const deadline = Date.now() + ms;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
			if (res.ok || res.status < 500) return true;
		} catch {
			/* retry */
		}
		await Bun.sleep(500);
	}
	return false;
}

async function main() {
	const buildDir = join(WEB_DIR, '.svelte-kit/cloudflare');
	if (!existsSync(buildDir)) {
		console.error('lighthouse:smoke — run `bun run build:web` first');
		process.exit(1);
	}

	const preview = spawn('bun', ['run', 'preview'], {
		cwd: WEB_DIR,
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, PORT: String(PREVIEW_PORT) }
	});

	let previewOut = '';
	preview.stdout?.on('data', (d) => {
		previewOut += d.toString();
	});
	preview.stderr?.on('data', (d) => {
		previewOut += d.toString();
	});

	const killPreview = () => {
		if (!preview.killed) preview.kill('SIGTERM');
	};
	process.on('exit', killPreview);
	process.on('SIGINT', () => {
		killPreview();
		process.exit(130);
	});

	const ready = await waitForUrl(PREVIEW_URL);
	if (!ready) {
		killPreview();
		console.error('lighthouse:smoke — preview not ready on', PREVIEW_URL);
		console.error(previewOut.slice(-800));
		process.exit(1);
	}

	const reportPath = join(ARTIFACT_ROOT, 'lh-smoke.json');

	const lh = await run(
		[
			'bunx',
			'--bun',
			'lighthouse',
			PREVIEW_URL,
			'--quiet',
			`--chrome-path=${CHROME_PATH}`,
			'--chrome-flags=--headless=new --no-sandbox --disable-gpu',
			'--only-categories=performance,accessibility,best-practices,seo',
			'--output=json',
			`--output-path=${reportPath}`
		],
		REPO_ROOT
	);

	killPreview();

	if (!lh.ok || !existsSync(reportPath)) {
		console.error('lighthouse:smoke — lighthouse CLI failed');
		console.error(lh.output.slice(-1200));
		process.exit(1);
	}

	let report: { categories?: Record<string, { score?: number | null }> };
	try {
		report = JSON.parse(readFileSync(reportPath, 'utf8'));
	} catch {
		console.error('lighthouse:smoke — invalid JSON output');
		process.exit(1);
	}

	const scores: Record<string, number> = {};
	let failed = false;
	for (const [key, min] of Object.entries(BUDGETS)) {
		const raw = report.categories?.[key]?.score;
		const pct = raw == null ? 0 : Math.round(raw * 100);
		scores[key] = pct;
		const ok = pct >= min;
		console.log(`  lighthouse ${key}: ${pct} (min ${min}) ${ok ? 'PASS' : 'FAIL'}`);
		if (!ok) failed = true;
	}

	if (failed) {
		console.error('lighthouse:smoke — budget miss (see docs/audits/web-performance.md)');
		process.exit(1);
	}
	console.log('lighthouse:smoke PASS');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
