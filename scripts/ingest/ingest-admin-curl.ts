#!/usr/bin/env bun
/**
 * curl helper for mutating ingest admin routes — sends X-Admin-Api-Key when set.
 * Reads ADMIN_API_KEY from env or workers/ingest/.dev.vars
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '../..');
const BASE = process.env.INGEST_URL ?? 'http://127.0.0.1:8787';

function adminKeyFromDevVars(): string | undefined {
	const path = join(REPO_ROOT, 'workers/ingest/.dev.vars');
	if (!existsSync(path)) return undefined;
	const text = readFileSync(path, 'utf8');
	for (const line of text.split('\n')) {
		const m = line.match(/^ADMIN_API_KEY=(.*)$/);
		if (m) return m[1]?.trim() || undefined;
	}
	return undefined;
}

const method = process.argv[2] ?? 'POST';
const path = process.argv[3] ?? '/admin/twitch/discover';
const bodyArg = process.argv[4];

const key = process.env.ADMIN_API_KEY?.trim() || adminKeyFromDevVars();
const headers: Record<string, string> = { 'content-type': 'application/json' };
if (key) headers['X-Admin-Api-Key'] = key;

const init: RequestInit = { method, headers };
if (bodyArg !== undefined && method !== 'GET') {
	init.body = bodyArg;
}

const res = await fetch(`${BASE}${path}`, init);
const text = await res.text();
process.stdout.write(text);
if (!text.endsWith('\n')) process.stdout.write('\n');
if (!res.ok) process.exit(1);
