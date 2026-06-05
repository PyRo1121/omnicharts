#!/usr/bin/env node
/** Pipe vitest output and drop vitest-pool-workers / wrangler chatter. Preserves exit code. */
import { spawn } from 'node:child_process';

function dropLine(line) {
	const t = line.trimEnd();
	if (!t) return false;
	return (
		t.startsWith('[vpw:debug]') || t.startsWith('[vpw:info]') || t.startsWith('[mf:warn]') || t === 'Using secrets defined in .dev.vars'
	);
}

function pipe(src, dest) {
	let pending = '';
	src.on('data', (buf) => {
		pending += buf.toString();
		const lines = pending.split('\n');
		pending = lines.pop() ?? '';
		for (const line of lines) {
			if (!dropLine(line)) dest.write(`${line}\n`);
		}
	});
	src.on('end', () => {
		if (pending && !dropLine(pending)) dest.write(`${pending}\n`);
	});
}

const child = spawn('vitest', ['run', ...process.argv.slice(2)], {
	stdio: ['inherit', 'pipe', 'pipe'],
	env: process.env,
});

pipe(child.stdout, process.stdout);
pipe(child.stderr, process.stderr);

child.on('close', (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	process.exit(code ?? 1);
});
