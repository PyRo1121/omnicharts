# Agent instructions (OmniCharts)

Read this file first. **Documentation is the source of truth** — update docs before code when requirements change.

## Project

- **Name:** OmniCharts (not “Streams Charts”)
- **Goal:** Free cross-platform streaming analytics (Twitch, Kick, YouTube)
- **MVP complete:** Phase 3 shipped **2026-06-05** — three-platform browse + Kick/YouTube ingest ([phase3-signoff](./docs/audits/phase3-signoff.md))
- **Current:** Phase 5 production deploy — [ROADMAP.md](./ROADMAP.md#phase-5--cloudflare-production-weeks-15-18); Phase 4 complete 2026-06-05 ([28-phase4-plan](./docs/28-phase4-plan.md))
- **Data:** Official platform APIs only — never scrape Streams Charts
- **Stack:** SvelteKit, Bun monorepo, SQLite (dev) → Cloudflare D1 + R2 (prod)
- **Ingest:** Separate Worker; Cron → Queues → poll ([ADR-002](./docs/adr/0002-twitch-eventsub-vs-polling.md))
- **Hosting:** Cloudflare; production ingest on **Workers Paid** ([ADR-004](./docs/adr/0004-cloudflare-free-vs-paid.md))

## Doc map

| Task | Read |
|------|------|
| What to build next | [ROADMAP.md](./ROADMAP.md) |
| MVP scope | [docs/01-competitive-parity-matrix.md](./docs/01-competitive-parity-matrix.md) |
| Metrics / tie-break | [docs/04-metrics-glossary.md](./docs/04-metrics-glossary.md) |
| Ingest | [docs/05-ingestion-per-platform.md](./docs/05-ingestion-per-platform.md) |
| Who we track | [docs/12-channel-discovery-and-tracking.md](./docs/12-channel-discovery-and-tracking.md) |
| Schema | [docs/06-storage-and-rollup-design.md](./docs/06-storage-and-rollup-design.md) |
| UI routes | [docs/09-ui-routes-and-components.md](./docs/09-ui-routes-and-components.md) |
| Cloudflare | [docs/11-cloudflare-deployment.md](./docs/11-cloudflare-deployment.md) |
| Ops | [docs/15-ingest-runbook.md](./docs/15-ingest-runbook.md) |
| Search / slugs | [docs/16-search-and-resolution.md](./docs/16-search-and-resolution.md) |
| Methodology UI copy | [docs/17-methodology-page.md](./docs/17-methodology-page.md) |
| Legal launch | [docs/18-legal-and-compliance-checklist.md](./docs/18-legal-and-compliance-checklist.md) |
| OpenAPI | [openapi/v1.yaml](./openapi/v1.yaml) |
| **Scaffold (CLI)** | [docs/19-project-scaffold-and-commands.md](./docs/19-project-scaffold-and-commands.md) |
| **Doc / CLI standards** | [docs/20-documentation-standards.md](./docs/20-documentation-standards.md) |
| **Twitch ingest** | [docs/21-twitch-ingest-libraries.md](./docs/21-twitch-ingest-libraries.md) |
| **Ingest Free-tier tuning** | [docs/22-ingest-free-tier-tuning.md](./docs/22-ingest-free-tier-tuning.md) |
| **Paid tier / zero overage** | [docs/23-paid-tier-zero-overage-playbook.md](./docs/23-paid-tier-zero-overage-playbook.md) — **zero manual flags** (wrangler `vars` + `.dev.vars.example` + code defaults table §1) |
| **Pre–Kick freeze** | [audits/README](./docs/audits/README.md) index · [23](./docs/23-audit-remediation-plan.md) (REM) · [24](./docs/24-remediation-grounding-audit.md) (matrix) · [26](./docs/26-twitch-freeze-execution-plan.md) (gates) · `bun run verify:twitch` |
| **Deps + API grounding** | [25](./docs/25-dependency-and-api-grounding.md) (Helix, bindings, toolchain pins) |
| **Scripts layout** | [scripts/README.md](./scripts/README.md) — `verify/` · `ingest/` · `dev/` |
| **Shared packages** | [27-monorepo-shared-packages](./docs/27-monorepo-shared-packages.md) — `@omnicharts/domain`, `@omnicharts/rollup`; Pages import packages only; `ingest/*` exports are Worker surface |
| **Cloudflare (current)** | [audits/README](./docs/audits/README.md) · [cloudflare-hardening-complete](./docs/audits/cloudflare-hardening-complete.md) |
| **Cloudflare (baseline audit)** | [cloudflare-free-tier-audit](./docs/audits/cloudflare-free-tier-audit.md) — historical |
| **Web perf / Lighthouse** | [audits/web-performance](./docs/audits/web-performance.md) |
| **Ingest D1 query audit** | [ingest-d1-query-audit](./docs/audits/ingest-d1-query-audit.md) |
| ADRs | [docs/adr/](./docs/adr/) |

## Implementation rules

0. **Scaffold with CLI** — SvelteKit: [`npx sv create`](https://svelte.dev/docs/kit/creating-a-project); Cloudflare: [`npx sv add sveltekit-adapter=adapter:cloudflare+cfTarget:pages`](https://svelte.dev/docs/cli/sveltekit-adapter) (not `sv add cloudflare`). Ingest: `npm create cloudflare@latest -- ingest`. **All commands:** [19](./docs/19-project-scaffold-and-commands.md); citation rules: [20](./docs/20-documentation-standards.md).
1. **Discovery loop:** `/` → search → `/channels/[slug]` — ship with homepage, not after.
2. **Rankings use rollups only** — no request-time sample scans.
3. **Retention:** 30d → 90d → 365d; “full career” = since `first_observed_at` in our DB.
4. **Free:** no paywalls; API/CSV in Phase 4–6 per roadmap (not launch blocker for browse).
5. **Kick:** official API expected ([ADR-003](./docs/adr/0003-kick-ingest-strategy.md)); fallback Twitch+YouTube.
6. **Ingest secrets:** Agents sync `workers/ingest/.dev.vars` → Cloudflare via `wrangler secret put` from `workers/ingest` ([15](./docs/15-ingest-runbook.md)); never ask the user to paste secrets. Never commit `.dev.vars`.
7. **Phase 1 Twitch ops:** Agents run `bun run verify:twitch` before claiming Twitch ingest/UI work done; includes `twitch:checkpoint --no-start-ingest` when ingest is up ([15](./docs/15-ingest-runbook.md#phase-1-twitch-checkpoint-agents)). Never ask the user to run manual discover/poll/rollup/rankings `curl` chains.

## Verify (when code exists)

```bash
bun run verify:twitch
```

Runs ingest unit tests + Twitch/DB coverage, web server-load Vitest, `lint` + `format:check`, ingest health check, `twitch:checkpoint --no-start-ingest`, then `check:web` and `build:web`. Start local ingest first: `bun run dev:ingest`.

See [docs/13-testing-and-verification.md](./docs/13-testing-and-verification.md).

## Autoresearch

External **agent loop skill** (Codex/Cursor autoresearch) for guided iteration — not a shipped CLI gate. Agents use **`bun run verify:twitch`** and **`bun run twitch:freeze-proof`** for official gates. Optional local helper: `bun run scripts/verify/autoresearch-phases02-verify.ts` or `bun run scripts/verify/index.ts autoresearch` (requires `dev:ingest`). **Artifacts:** `./autoresearch-results/` (gitignored — Lighthouse JSON, loop logs). Script layout: [scripts/README.md](./scripts/README.md).

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Stream Charts** (5169 symbols, 9895 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Stream Charts/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Stream Charts/clusters` | All functional areas |
| `gitnexus://repo/Stream Charts/processes` | All execution flows |
| `gitnexus://repo/Stream Charts/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Cursor Cloud specific instructions

### Toolchain

- **Bun** is pinned in root `package.json` (`packageManager: bun@1.3.14`). If `bun` is missing, install from [bun.sh](https://bun.sh/docs/installation) and ensure `~/.bun/bin` is on `PATH`.
- **Node.js** 20+ is used by Wrangler/Vitest; Node 22 works in practice.
- Run `bun run scripts/dev/wrangler-decline-skills.ts` once per VM if Wrangler prints the agent-skills prompt (breaks JSON parsers in `d1:verify-schema`).

### Services (local dev)

| Service | Command | URL |
|---------|---------|-----|
| Web (SvelteKit/Vite) | `bun run dev:web` | http://localhost:5173 |
| Ingest Worker | `bun run dev:ingest` | http://127.0.0.1:8787 (`/health`) |

Use **tmux** for long-running dev servers. Ingest `dev` already runs `wrangler-decline-skills` before `wrangler dev --test-scheduled`.

### D1 local database (critical)

Ingest and web each maintain a **separate** local D1 SQLite under their own `.wrangler/state`. After schema changes, apply migrations to **both**:

```bash
bun run d1:migrate:local                              # workers/ingest D1
bun run --cwd apps/web wrangler d1 migrations apply omnicharts --local   # web platformProxy D1
```

Without the web migration, `bun run dev:web` returns 500 (`no such table: channel_daily_rollups`).

### Demo without API secrets

- UI design preview: `http://localhost:5173/?demo=1` (or `DEV_MOCK=1`).
- Ingest `/health` returns **503** with `missing_credentials` when `workers/ingest/.dev.vars` is absent — expected; DB and routes still work.
- Live Twitch/Kick/YouTube polling requires secrets per `workers/ingest/.dev.vars.example` and [15-ingest-runbook.md](./docs/15-ingest-runbook.md).

### Verify / lint (see [13-testing-and-verification.md](./docs/13-testing-and-verification.md))

| Gate | Command | Notes |
|------|---------|-------|
| Lint | `bun run lint` | oxlint |
| Format | `bun run format:check` | oxfmt |
| Unit tests | `bun run test` | Full unit gate (domain, rollup, ingest, web) |
| Full verify | `bun run verify:twitch` | Requires `dev:ingest` running; CI sets `VERIFY_SKIP_CHECKPOINT=1` without Helix secrets |
| Web build | `bun run check:web && bun run build:web` | SvelteKit + Cloudflare adapter |
