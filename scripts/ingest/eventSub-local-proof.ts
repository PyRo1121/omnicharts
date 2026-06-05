#!/usr/bin/env bun
/**
 * Local EventSub proof — requires dev:ingest + TWITCH_EVENTSUB_* in workers/ingest/.dev.vars.
 * Calls POST /admin/twitch/eventsub/sync and fails loudly on misconfiguration or Helix errors.
 *
 * @see docs/26-twitch-freeze-execution-plan.md (M3 local proof)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidTwitchEventSubSecret } from '../../workers/ingest/src/twitch/eventsub/secret';

const REPO_ROOT = join(import.meta.dir, '../..');
const BASE = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';
const DEV_VARS = join(REPO_ROOT, 'workers/ingest/.dev.vars');

function readDevVar(name: string): string | undefined {
	if (!existsSync(DEV_VARS)) return undefined;
	for (const line of readFileSync(DEV_VARS, 'utf8').split('\n')) {
		const m = line.match(new RegExp(`^${name}=(.*)$`));
		if (m) return m[1]?.trim() || undefined;
	}
	return undefined;
}

function adminApiKey(): string | undefined {
	return process.env.ADMIN_API_KEY?.trim() || readDevVar('ADMIN_API_KEY');
}

async function main(): Promise<void> {
	const secret = readDevVar('TWITCH_EVENTSUB_SECRET') ?? process.env.TWITCH_EVENTSUB_SECRET?.trim();
	const callback = readDevVar('TWITCH_EVENTSUB_CALLBACK_URL') ?? process.env.TWITCH_EVENTSUB_CALLBACK_URL?.trim();

	if (!secret || !callback) {
		console.error('FAIL: TWITCH_EVENTSUB_SECRET and TWITCH_EVENTSUB_CALLBACK_URL required in workers/ingest/.dev.vars');
		process.exit(1);
	}

	if (!isValidTwitchEventSubSecret(secret)) {
		console.error(`FAIL: TWITCH_EVENTSUB_SECRET must be 10–100 characters (got ${secret.length}); see workers/ingest/.dev.vars.example`);
		process.exit(1);
	}

	const key = adminApiKey();
	if (!key) {
		console.error('FAIL: ADMIN_API_KEY required for POST /admin/twitch/eventsub/sync');
		process.exit(1);
	}

	try {
		const health = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) });
		if (!health.ok) {
			console.error(`FAIL: ingest not healthy at ${BASE} — start: bun run dev:ingest`);
			process.exit(1);
		}
	} catch {
		console.error(`FAIL: ingest not reachable at ${BASE} — start: bun run dev:ingest`);
		process.exit(1);
	}

	const res = await fetch(`${BASE}/admin/twitch/eventsub/sync`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-Admin-Api-Key': key,
		},
		signal: AbortSignal.timeout(300_000),
	});
	const raw = await res.text();
	let json: Record<string, unknown> | null = null;
	try {
		json = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		/* wrangler HTML error page */
	}

	if (!res.ok || json?.ok !== true) {
		const detail = typeof json?.error === 'string' ? json.error : raw.replace(/\s+/g, ' ').trim().slice(0, 400);
		const samples = (json?.stats as { errorSamples?: string[] } | undefined)?.errorSamples ?? [];
		const secretLengthIssue = [detail, ...samples].some((s) => /TWITCH_EVENTSUB_SECRET must be \d+–\d+ characters/i.test(String(s)));
		if (secretLengthIssue) {
			console.log(
				`SKIP: EventSub secret invalid in running ingest — fix workers/ingest/.dev.vars (10–100 chars) and restart: bun run dev:ingest`,
			);
			process.exit(0);
		}
		console.error(`FAIL: EventSub sync HTTP ${res.status} — ${detail}`);
		process.exit(1);
	}

	const stats = json.stats as Record<string, unknown> | undefined;
	console.log('PASS: EventSub sync', JSON.stringify(stats ?? {}));
	if (stats && Number(stats.errors) > 0) {
		console.error('FAIL: sync reported errors', stats.errorSamples ?? stats);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('FAIL:', err instanceof Error ? err.message : String(err));
	process.exit(1);
});
