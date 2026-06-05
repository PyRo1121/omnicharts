#!/usr/bin/env bun
/**
 * Verify CLI — subcommands map to scripts/verify/*.ts
 * @see docs/13-testing-and-verification.md
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '../..');
const DIR = import.meta.dir;

const COMMANDS: Record<string, string> = {
	twitch: 'twitch-e2e-verify.ts',
	'freeze-proof': 'twitch-e2e-verify.ts',
	autoresearch: 'autoresearch-phases02-verify.ts',
	lighthouse: 'lighthouse-smoke.ts',
	d1: 'verify-d1-schema.ts',
	wrangler: 'verify-wrangler-production-env.ts',
	checkpoint: 'twitch-phase1-checkpoint.ts'
};

const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || !(cmd in COMMANDS)) {
	console.error(`Usage: bun run scripts/verify/index.ts <${Object.keys(COMMANDS).join('|')}> [...args]`);
	process.exit(1);
}

const extra =
	cmd === 'freeze-proof' ? ['--proof-matrix', ...rest] : cmd === 'd1' && rest[0] === '--remote' ? ['--remote', ...rest.slice(1)] : rest;

const script = join(DIR, COMMANDS[cmd]!);
const result = spawnSync('bun', ['run', script, ...extra], { cwd: REPO_ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
