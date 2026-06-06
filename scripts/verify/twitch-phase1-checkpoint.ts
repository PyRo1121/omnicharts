#!/usr/bin/env bun
/**
 * Phase 1 Twitch ops checkpoint — one command for local ingest verification.
 * @see docs/15-ingest-runbook.md
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import {
	formatJsonField,
	parseJsonRecord,
	readErrorMessage,
	readItemSlug,
	readResponseJson,
	readStatsNestedNumber,
	readStatsNumber,
	readString,
} from '../lib/json-guards';

const REPO_ROOT = join(import.meta.dir, '../..');
const DEV_VARS = join(REPO_ROOT, 'workers/ingest/.dev.vars');

function adminApiKey(): string | undefined {
	const fromEnv = process.env.ADMIN_API_KEY?.trim();
	if (fromEnv) return fromEnv;
	if (!existsSync(DEV_VARS)) return undefined;
	for (const line of readFileSync(DEV_VARS, 'utf8').split('\n')) {
		const m = line.match(/^ADMIN_API_KEY=(.*)$/);
		if (m) return m[1]?.trim() || undefined;
	}
	return undefined;
}

function adminFetchHeaders(): Record<string, string> {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	const key = adminApiKey();
	if (key) headers['X-Admin-Api-Key'] = key;
	return headers;
}
const BASE = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';
const START_INGEST = !process.argv.includes('--no-start-ingest');
const SKIP_ENRICH = process.argv.includes('--no-enrich');
/** Full coverage cycle (slow) instead of quick global sweep ×2. */
const FULL_POLL = process.argv.includes('--full');

const STEP_WAIT_MS = 1500;
const HEALTH_POLL_MS = 500;
const HEALTH_TIMEOUT_MS = 90_000;
/** Discover + coverage poll can exceed 5m on cold local D1 + Helix pagination. */
const ADMIN_PIPELINE_TIMEOUT_MS = 900_000;

type StepResult = {
	name: string;
	critical: boolean;
	pass: boolean;
	skip?: boolean;
	detail: string;
};

const steps: StepResult[] = [];

function record(step: Omit<StepResult, 'pass'> & { pass: boolean }) {
	steps.push(step);
	const mark = step.skip ? 'SKIP' : step.pass ? 'PASS' : 'FAIL';
	console.log(`  [${mark}] ${step.name}: ${step.detail}`);
}

async function sleep(ms: number): Promise<void> {
	await new Promise((r) => setTimeout(r, ms));
}

function runCmd(cmd: string[], cwd: string): Promise<{ ok: boolean; exitCode: number | null; output: string }> {
	return new Promise((resolve) => {
		const proc = spawn(cmd[0], cmd.slice(1), { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		let output = '';
		proc.stdout?.on('data', (d) => {
			output += d.toString();
		});
		proc.stderr?.on('data', (d) => {
			output += d.toString();
		});
		proc.on('close', (code) => resolve({ ok: code === 0, exitCode: code, output: output.trim() }));
	});
}

const MIGRATE_RETRY_ATTEMPTS = 8;
const MIGRATE_RETRY_MS = 2000;

function migrateLooksLocked(output: string): boolean {
	return /SQLITE_BUSY|database is locked/i.test(output);
}

/** Wrangler success = exit 0 only (stderr banners ignored). Retries when local D1 is locked by dev ingest. */
async function runD1MigrateLocal(): Promise<{ ok: boolean; detail: string }> {
	let last: { exitCode: number | null; output: string } = { exitCode: null, output: '' };
	for (let attempt = 1; attempt <= MIGRATE_RETRY_ATTEMPTS; attempt++) {
		const result = await runCmd(['bun', 'run', 'd1:migrate:local'], REPO_ROOT);
		last = { exitCode: result.exitCode, output: result.output };
		if (result.ok) {
			const hint = /no migrations to apply/i.test(result.output) ? 'already applied' : 'applied';
			return { ok: true, detail: hint };
		}
		if (!migrateLooksLocked(result.output) || attempt === MIGRATE_RETRY_ATTEMPTS) break;
		console.log(`  d1:migrate:local locked by running ingest — retry ${attempt}/${MIGRATE_RETRY_ATTEMPTS}…`);
		await sleep(MIGRATE_RETRY_MS);
	}
	const code = last.exitCode ?? '?';
	const snippet = last.output.replace(/\s+/g, ' ').trim().slice(0, 100);
	return { ok: false, detail: `exit ${code}${snippet ? ` — ${snippet}` : ''}` };
}

const ADMIN_RETRY_ATTEMPTS = 4;
const ADMIN_RETRY_MS = 3000;

function adminShouldRetry(status: number, raw: string): boolean {
	if (status === 503 || status === 502 || status === 429) return true;
	return /worker restarted mid-request|temporarily unavailable/i.test(raw);
}

async function fetchHealth(): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null }> {
	try {
		const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) });
		const body = await readResponseJson(res);
		return { ok: res.ok, status: res.status, body };
	} catch {
		return { ok: false, status: 0, body: null };
	}
}

async function waitForHealth(): Promise<Record<string, unknown> | null> {
	const deadline = Date.now() + HEALTH_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const h = await fetchHealth();
		if (h.body) return h.body;
		await sleep(HEALTH_POLL_MS);
	}
	return null;
}

/** Avoid admin calls while wrangler dev is mid-reload (503 / worker restarted). */
async function waitForStableIngest(): Promise<void> {
	const deadline = Date.now() + HEALTH_TIMEOUT_MS;
	let okStreak = 0;
	while (Date.now() < deadline) {
		const h = await fetchHealth();
		const stable =
			h.ok && (h.body?.status === 'ok' || h.body?.status === 'degraded') && h.body?.db === 'connected' && h.body?.twitch === 'configured';
		if (stable) {
			okStreak++;
			if (okStreak >= 3) return;
		} else {
			okStreak = 0;
		}
		await sleep(2000);
	}
	if (process.env.CHECKPOINT_ALLOW_UNSTABLE === '1') {
		console.log('  (ingest health not stable 3× — continuing anyway)');
		return;
	}
	throw new Error('ingest health not stable 3× before checkpoint');
}

function startIngestBackground(): void {
	console.log('\n  Starting ingest in background: bun run dev:ingest');
	console.log('  (Wrangler loads workers/ingest/.dev.vars only at startup.)\n');
	spawn('bun', ['run', 'dev:ingest'], {
		cwd: REPO_ROOT,
		detached: true,
		stdio: 'ignore',
	}).unref();
}

function bodySnippet(raw: string, maxLen = 200): string {
	const oneLine = raw.replace(/\s+/g, ' ').trim();
	if (!oneLine) return '';
	return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine;
}

function adminErrorHint(status: number, json: Record<string, unknown> | null, raw: string): string {
	const snippet = bodySnippet(raw);
	const err = readErrorMessage(json);
	if (err) {
		return snippet && !err.includes(snippet) ? `${err} — ${snippet}` : err;
	}
	const line = raw.split('\n')[0]?.trim() ?? '';
	if (line.includes('FOREIGN KEY')) {
		return `D1 FK constraint (channel/game row missing?)${snippet ? ` — ${snippet}` : ''}`;
	}
	if (line.includes('Invalid username') || raw.includes('invalid broadcaster')) {
		return `Helix bad channel IDs in DB${snippet ? ` — ${snippet}` : ''}`;
	}
	if (line.startsWith('Error:')) return snippet ? `${line.slice(0, 80)} — ${snippet}` : line.slice(0, 120);
	if (snippet) return `HTTP ${status} — ${snippet}`;
	return `HTTP ${status}`;
}

async function postJson(
	path: string,
	body: Record<string, unknown> = {},
	timeoutMs = ADMIN_PIPELINE_TIMEOUT_MS,
): Promise<{ status: number; json: Record<string, unknown> | null; raw: string }> {
	const res = await fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: adminFetchHeaders(),
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs),
	});
	const raw = await res.text();
	const json = parseJsonRecord(raw);
	return { status: res.status, json, raw };
}

async function postJsonWithRetry(
	path: string,
	body: Record<string, unknown> = {},
): Promise<{ status: number; json: Record<string, unknown> | null; raw: string }> {
	try {
		let last = await postJson(path, body);
		for (let attempt = 1; attempt < ADMIN_RETRY_ATTEMPTS; attempt++) {
			if (!adminShouldRetry(last.status, last.raw)) return last;
			console.log(`  ${path} HTTP ${last.status} — retry ${attempt}/${ADMIN_RETRY_ATTEMPTS - 1}…`);
			await sleep(ADMIN_RETRY_MS);
			await waitForStableIngest();
			last = await postJson(path, body);
		}
		return last;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { status: 0, json: null, raw: msg };
	}
}

async function getJson(path: string): Promise<{ status: number; json: Record<string, unknown> | null }> {
	const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(60_000) });
	const json = await readResponseJson(res);
	return { status: res.status, json };
}

function isOkAdmin(json: Record<string, unknown> | null, status: number): boolean {
	return status >= 200 && status < 300 && json?.ok === true;
}

function itemCount(json: Record<string, unknown> | null): number {
	const items = json?.items;
	return Array.isArray(items) ? items.length : 0;
}

function todayUtcDateString(): string {
	return new Date().toISOString().slice(0, 10);
}

function firstSlug(json: Record<string, unknown> | null): string | null {
	return readItemSlug(json?.items);
}

async function main(): Promise<number> {
	console.log('OmniCharts Twitch Phase 1 checkpoint');
	console.log(`  ingest: ${BASE}\n`);

	// 1. .dev.vars
	const devVarsOk = existsSync(DEV_VARS);
	record({
		name: 'workers/ingest/.dev.vars',
		critical: true,
		pass: devVarsOk,
		detail: devVarsOk ? 'file exists' : 'missing — copy from .dev.vars.example',
	});
	if (!devVarsOk) return finish(1);

	// 2. D1 migrate local — only while ingest is down (concurrent wrangler dev + migrate locks/crashes D1)
	const health = await fetchHealth();
	if (health.body?.db === 'connected') {
		record({
			name: 'd1:migrate:local',
			critical: true,
			pass: true,
			skip: true,
			detail: 'skipped — ingest running (avoids SQLITE_BUSY); db=connected in /health',
		});
	} else {
		const migrate = await runD1MigrateLocal();
		record({
			name: 'd1:migrate:local',
			critical: true,
			pass: migrate.ok,
			detail: migrate.detail,
		});
		if (!migrate.ok) return finish(1);
	}

	// 3. Health / optional start ingest
	if (!health.body && START_INGEST) {
		console.log('  Ingest not reachable — starting dev:ingest in background…');
		startIngestBackground();
		health.body = await waitForHealth();
	}

	if (!health.body) {
		record({
			name: 'GET /health',
			critical: true,
			pass: false,
			detail: `no response — start dev:ingest in another terminal (${BASE}/health)`,
		});
		return finish(1);
	}

	const twitch = health.body.twitch;
	const twitchOk = twitch === 'configured';
	record({
		name: 'GET /health',
		critical: true,
		pass: true,
		detail: `status=${formatJsonField(health.body.status)} db=${formatJsonField(health.body.db)} twitch=${formatJsonField(twitch)}`,
	});

	record({
		name: 'twitch credentials (health)',
		critical: true,
		pass: twitchOk,
		detail: twitchOk
			? 'configured'
			: 'missing_credentials — restart ingest after editing .dev.vars (wrangler reads secrets only at startup)',
	});
	if (!twitchOk) return finish(1);

	await waitForStableIngest();
	await sleep(STEP_WAIT_MS);

	const reset = await postJsonWithRetry('/admin/dev/reset-for-live-test');
	record({
		name: 'POST /admin/dev/reset-for-live-test',
		critical: false,
		pass: reset.status >= 200 && reset.status < 300,
		detail: isOkAdmin(reset.json, reset.status)
			? `cleared ${readStatsNumber(reset.json, 'channelsDeleted') ?? 0} dev-seed channels`
			: adminErrorHint(reset.status, reset.json, reset.raw),
	});

	await sleep(STEP_WAIT_MS);

	// 5. Admin pipeline
	const discover = await postJsonWithRetry('/admin/twitch/discover', { quick: true });
	record({
		name: 'POST /admin/twitch/discover',
		critical: true,
		pass: isOkAdmin(discover.json, discover.status),
		detail: isOkAdmin(discover.json, discover.status)
			? `games=${readStatsNumber(discover.json, 'gamesScanned') ?? '?'} channels=${readStatsNumber(discover.json, 'channelsUpserted') ?? '?'}`
			: adminErrorHint(discover.status, discover.json, discover.raw),
	});

	await sleep(STEP_WAIT_MS);

	const pollBody = FULL_POLL ? {} : { quick: true };
	const poll = await postJsonWithRetry('/admin/twitch/poll', pollBody);
	record({
		name: 'POST /admin/twitch/poll',
		critical: true,
		pass: isOkAdmin(poll.json, poll.status),
		detail: isOkAdmin(poll.json, poll.status)
			? `mode=${formatJsonField(poll.json?.mode, 'coverage_cycle')} streams=${readStatsNumber(poll.json, 'streamsSeen') ?? readStatsNestedNumber(poll.json, 'global', 'streamsSeen') ?? '?'}`
			: adminErrorHint(poll.status, poll.json, poll.raw),
	});

	if (!FULL_POLL) {
		console.log('  Second quick sweep (promote discovered → tracked)…');
		await sleep(STEP_WAIT_MS);
		const poll2 = await postJsonWithRetry('/admin/twitch/poll', { quick: true });
		record({
			name: 'POST /admin/twitch/poll (2nd)',
			critical: true,
			pass: isOkAdmin(poll2.json, poll2.status),
			detail: isOkAdmin(poll2.json, poll2.status)
				? `mode=${formatJsonField(poll2.json?.mode)} streams=${readStatsNumber(poll2.json, 'streamsSeen') ?? '?'}`
				: adminErrorHint(poll2.status, poll2.json, poll2.raw),
		});
	}

	if (!SKIP_ENRICH) {
		await sleep(STEP_WAIT_MS);
		const enrich = await postJsonWithRetry('/admin/twitch/enrich-profiles');
		const enrichOk = isOkAdmin(enrich.json, enrich.status);
		const enrichSkip =
			!enrichOk &&
			(enrich.status === 0 ||
				enrich.status >= 500 ||
				adminShouldRetry(enrich.status, enrich.raw) ||
				/enrich|helix|credentials|no candidates/i.test(adminErrorHint(enrich.status, enrich.json, enrich.raw)));
		record({
			name: 'POST /admin/twitch/enrich-profiles',
			critical: false,
			pass: enrichOk || enrichSkip,
			skip: enrichSkip && !enrichOk,
			detail: enrichOk
				? `updated=${readStatsNumber(enrich.json, 'updated') ?? 0}`
				: enrichSkip
					? `skipped — ${adminErrorHint(enrich.status, enrich.json, enrich.raw)}`
					: adminErrorHint(enrich.status, enrich.json, enrich.raw),
		});
	}

	await sleep(STEP_WAIT_MS);

	const rollupDate = todayUtcDateString();
	let rollup = await postJsonWithRetry('/admin/rollup/daily', { date: rollupDate });
	if (!isOkAdmin(rollup.json, rollup.status) && rollup.status === 503) {
		console.log('  POST /admin/rollup/daily HTTP 503 — extra rollup retry after ingest stable…');
		await sleep(ADMIN_RETRY_MS);
		await waitForStableIngest();
		rollup = await postJson('/admin/rollup/daily', { date: rollupDate });
	}
	const rollupChannels = readStatsNumber(rollup.json, 'channelsProcessed');
	record({
		name: 'POST /admin/rollup/daily',
		critical: true,
		pass: isOkAdmin(rollup.json, rollup.status),
		detail: isOkAdmin(rollup.json, rollup.status)
			? `date=${rollupDate} channels=${rollupChannels ?? '?'}`
			: adminErrorHint(rollup.status, rollup.json, rollup.raw),
	});

	await sleep(STEP_WAIT_MS);

	const rankings = await getJson('/v1/rankings/channels?platform=twitch&period=7d&limit=20');
	const channelCount = itemCount(rankings.json);
	const sampleSlug = firstSlug(rankings.json);
	record({
		name: 'GET /v1/rankings/channels',
		critical: true,
		pass: rankings.status === 200 && channelCount > 0,
		detail:
			channelCount > 0
				? `HTTP ${rankings.status} items=${channelCount}`
				: `HTTP ${rankings.status} items=0 — need samples today, tracked state, rollup date=${rollupDate}; local wrangler uses TWITCH_RANKING_MIN_AIRTIME_MINUTES=1`,
	});

	await sleep(STEP_WAIT_MS);

	const games = await getJson('/v1/rankings/games?platform=twitch&period=7d&limit=10');
	const gameCount = itemCount(games.json);
	record({
		name: 'GET /v1/rankings/games',
		critical: true,
		pass: games.status === 200,
		detail: `HTTP ${games.status} items=${gameCount}`,
	});

	await sleep(STEP_WAIT_MS);

	if (!sampleSlug) {
		record({
			name: 'GET /v1/channels/{slug}',
			critical: true,
			pass: true,
			skip: true,
			detail: 'skipped — no channels in 7d rankings (discover/poll/rollup may need data)',
		});
	} else {
		const channelPath = `/v1/channels/${encodeURIComponent(sampleSlug)}?platform=twitch`;
		const channel = await getJson(channelPath);
		const channelOk = channel.status === 200 && channel.json != null && readString(channel.json, 'slug') !== undefined;
		record({
			name: 'GET /v1/channels/{slug}',
			critical: true,
			pass: channelOk,
			detail: `slug=${sampleSlug} HTTP ${channel.status}`,
		});
	}

	return finish(0);
}

function finish(_ignored: number): number {
	console.log('\n── Summary ─────────────────────────────────────');
	const nameWidth = Math.max(...steps.map((s) => s.name.length), 8);
	for (const s of steps) {
		const mark = s.skip ? 'SKIP' : s.pass ? 'PASS' : 'FAIL';
		const crit = s.critical ? '' : ' (opt)';
		console.log(`  ${mark.padEnd(4)} ${s.name.padEnd(nameWidth)}${crit}  ${s.detail}`);
	}

	const rankingsStep = steps.find((s) => s.name === 'GET /v1/rankings/channels');
	const channelStep = steps.find((s) => s.name.startsWith('GET /v1/channels'));
	const match = rankingsStep?.detail.match(/items=(\d+)/);
	const channelCount = match ? match[1] : '?';
	const slugMatch = channelStep?.detail.match(/slug=([^\s]+)/);
	const sampleSlug = slugMatch?.[1] ?? '—';

	console.log('\n  Rankings channels (7d):', channelCount);
	console.log('  Sample slug:', sampleSlug);

	const criticalFailed = steps.some((s) => s.critical && !s.pass && !s.skip);
	const exitCode = criticalFailed ? 1 : 0;
	console.log(exitCode === 0 ? '\nCheckpoint PASSED' : '\nCheckpoint FAILED');
	return exitCode;
}

main()
	.then((code) => process.exit(code))
	.catch((err) => {
		const msg = err instanceof Error ? err.message : String(err);
		record({
			name: 'checkpoint runner',
			critical: true,
			pass: false,
			detail: msg,
		});
		process.exit(finish(1));
	});
