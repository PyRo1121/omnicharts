#!/usr/bin/env bun
/**
 * Decline Wrangler's interactive Cloudflare agent-skills install prompt once globally.
 * Wrangler skips the prompt when ~/.wrangler/agents-skills-install.jsonc exists (accepted: false).
 * @see https://developers.cloudflare.com/workers/wrangler/commands/#dev
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function globalWranglerDir(): string {
	const legacy = join(homedir(), '.wrangler');
	if (existsSync(legacy)) return legacy;
	const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
	return join(xdg, '.wrangler');
}

const path = join(globalWranglerDir(), 'agents-skills-install.jsonc');
if (existsSync(path)) {
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as { version?: number };
		if (parsed.version !== undefined) process.exit(0);
	} catch {
		/* rewrite below */
	}
}

mkdirSync(globalWranglerDir(), { recursive: true });
writeFileSync(
	path,
	`${JSON.stringify(
		{
			version: 1,
			accepted: false,
			date: new Date().toISOString(),
			detectedAgents: [],
		},
		null,
		'\t',
	)}\n`,
);
