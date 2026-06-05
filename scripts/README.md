# OmniCharts scripts

Root `package.json` exposes thin aliases only — implementation lives here.

| Directory | Purpose | Entry points |
|-----------|---------|--------------|
| [`verify/`](./verify/) | Gates, schema, Lighthouse, checkpoint | `verify:twitch`, `twitch:freeze-proof`, `lighthouse:smoke`, `d1:verify-schema*`, `verify:wrangler-production`, `twitch:checkpoint*` |
| [`ingest/`](./ingest/) | Admin curl, cron trigger, EventSub local proof | `twitch:discover`, `twitch:sweep`, `ingest:cron`, `twitch:eventsub-local-proof`, … |
| [`dev/`](./dev/) | Local dev ergonomics | `dev:ingest` (wrangler skills prompt), ingest `test` (vitest noise filter) |

**Verify subcommands:** `bun run scripts/verify/index.ts twitch|freeze-proof|lighthouse|d1|wrangler|checkpoint`

**Optional (agent loop, not a gate):** `bun run scripts/verify/index.ts autoresearch` — phases 0–2 bundle for foreground autoresearch; official gates remain `verify:twitch` / `twitch:freeze-proof`.

**Autoresearch artifacts:** `./autoresearch-results/` (gitignored) — see [AGENTS.md](../AGENTS.md#autoresearch).

Command SSOT: [docs/13-testing-and-verification.md](../docs/13-testing-and-verification.md) · scaffold: [docs/19](../docs/19-project-scaffold-and-commands.md).
