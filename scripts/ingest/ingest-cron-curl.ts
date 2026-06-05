#!/usr/bin/env bun
/**
 * Fire local ingest scheduled handler via Wrangler dev middleware (/__scheduled).
 * Requires dev:ingest with --test-scheduled (see workers/ingest package.json dev script).
 */
const BASE = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';
const cron = process.argv[2] ?? '*/1 * * * *';
const url = `${BASE}/__scheduled?cron=${encodeURIComponent(cron)}`;

const res = await fetch(url);
const text = await res.text();
process.stdout.write(text);
if (!text.endsWith('\n')) process.stdout.write('\n');
if (!res.ok) {
	console.error(`ingest:cron failed HTTP ${res.status} — is dev:ingest running with --test-scheduled?`);
	process.exit(1);
}
