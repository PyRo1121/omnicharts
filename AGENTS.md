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

Runs ingest unit tests + Twitch/DB coverage, web server-load Vitest, ingest health check, `twitch:checkpoint --no-start-ingest`, then `check:web` and `build:web`. Start local ingest first: `bun run dev:ingest`.

See [docs/13-testing-and-verification.md](./docs/13-testing-and-verification.md).

## Autoresearch

External **agent loop skill** (Codex/Cursor autoresearch) for guided iteration — not a shipped CLI gate. Agents use **`bun run verify:twitch`** and **`bun run twitch:freeze-proof`** for official gates. Optional local helper: `bun run scripts/verify/autoresearch-phases02-verify.ts` or `bun run scripts/verify/index.ts autoresearch` (requires `dev:ingest`). **Artifacts:** `./autoresearch-results/` (gitignored — Lighthouse JSON, loop logs). Script layout: [scripts/README.md](./scripts/README.md).
