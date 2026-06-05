# Twitch freeze execution plan (doc 26)

**Date:** 2026-06-03  
**Purpose:** Operational runbook from current remediation state → Twitch freeze gate (G1–G12) → Phase 3 Kick start ([ADR-003](./adr/0003-kick-ingest-strategy.md)).  
**Related:** [23-audit-remediation-plan](./23-audit-remediation-plan.md) · [24-remediation-grounding-audit](./24-remediation-grounding-audit.md) · [25-dependency-and-api-grounding](./25-dependency-and-api-grounding.md) · [audits/README](./audits/README.md) · [ROADMAP Phase 3](../ROADMAP.md#phase-3--multi-platform-weeks-710) · [AGENTS.md](../AGENTS.md)

### Audit doc map (no duplicate reading)

| Doc | Role |
|-----|------|
| [23](./23-audit-remediation-plan.md) | REM backlog + freeze gate G1–G12 |
| [24](./24-remediation-grounding-audit.md) | Phase 0–2 operational matrix |
| [25](./25-dependency-and-api-grounding.md) | Helix, bindings, toolchain pins |
| **This file (26)** | Gate status, M0–M5 milestones, next tasks |
| Verify command SSOT | [13-testing-and-verification.md](./13-testing-and-verification.md) |

---

## 1. Current state

### REM completion

| Metric | Value |
|--------|-------|
| **REM items done** | **36 / 36** (100%) |
| **P0 open (ops proof)** | G3 remote deploy vars |
| **P2 REM backlog** | **Closed** — REM-015, REM-016, REM-035 done 2026-06-03 |

**Done (code + tests):** REM-001–036 inclusive ([23](./23-audit-remediation-plan.md)).

**Ops proof still open:** G3 prod deploy vars, G11–G12 maintainer sign-off (not REM backlog).

### Freeze gate checklist (G1–G12)

Re-run evidence after each wave. Full local gate: `bun run dev:ingest` then `bun run verify:twitch` (no `VERIFY_SKIP_CHECKPOINT`).

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| G1 | `bun run verify:twitch` passes locally (ingest up + checkpoint) | [x] | `bun run dev:ingest` → `bun run verify:twitch` — **PASS 2026-06:** 6/6 steps (checkpoint incl.; prior rollup fix: `follower-snapshots.ts` batched IN, size 50) |
| G2 | Remote D1 at migration **0008**; schema matches `migrations/d1/` | [x] | **2026-06-03:** `d1:migrate:remote` → `No migrations to apply!`; `d1:verify-schema:remote` → `PASS — 11 tables, indexes through 0008 (remote)` |
| G3 | Production ingest vars: `TWITCH_RANKING_MIN_AIRTIME_MINUTES=60`, `TWITCH_MIN_VIEWERS=20` | [ ] | `workers/ingest/wrangler.jsonc` `[env.production].vars` + deploy screenshot |
| G4 | `/admin/*` mutating routes require secret; dev routes disabled in prod; no silent mock fallback | [x] | `admin-auth.spec.ts`, `public-http-edge.spec.ts`, REM-036 |
| G5 | `followers_delta` populated on rollup days with follower snapshots | [x] | `rollup-daily-job.spec.ts`, `helix-to-rollup.integration.spec.ts` |
| G6 | `viewer_samples` prune keeps hot window ≤14d | [x] | `prune-samples.spec.ts` |
| G7 | Rankings API returns non-null `peak_viewers` / `airtime_hours` from rollups | [x] | REM-010/013, `channels-api.spec.ts` |
| G8 | `/privacy` and `/terms` stub pages live; footer links | [x] | REM-023, [18-legal](./18-legal-and-compliance-checklist.md) (stubs — legal review still pre-beta) |
| G9 | `slug_history` → 301 on web; search respects active `platform` tab | [x] | REM-017/020, `channel.test.ts` |
| G10 | Kick/YouTube cron documented or gated (no silent no-op in prod) | [x] | REM-033, [15-ingest-runbook](./15-ingest-runbook.md) |
| G11 | ROADMAP Phase 3 Kick checkbox only after G1–G10 and **G12** | [ ] | Maintainer sign-off |
| G12 | [doc 24](./24-remediation-grounding-audit.md) matrix: every row **OPERATIONAL** (except documented remote/prod proofs) | [ ] | Matrix review + `bun run twitch:freeze-proof` |

**CI note:** Default CI skips checkpoint (`VERIFY_SKIP_CHECKPOINT=1`). Optional full CI: `VERIFY_FULL=1` + ingest + secrets ([13](./13-testing-and-verification.md)).

---

## 2. Milestones (ordered)

### M0 — Code + tests complete

**Status:** ~86% REM done; ingest + web unit/integration coverage green in CI.

| Area | Done |
|------|------|
| Admin auth, prod vars config, dev route guard | REM-001, 002, 007 |
| Rollup truth (`followers_delta`, prune, peak/airtime) | REM-008, 009, 010, 012 |
| Web P0 (slug 301, platform search, legal stubs, no mock path) | REM-017, 020, 023, 036 |
| Verification harness | REM-030–033, `verify:twitch`, CI workflow |
| Grounding audits | [24](./24-remediation-grounding-audit.md), [25](./25-dependency-and-api-grounding.md) |

**Remaining code/ops before freeze:** REM-003 (remote D1), operator proof runs (G3, EventSub prod).

### M1 — Local operational proof

**Goal:** Prove live local ingest pipeline without manual curl chains.

| Step | Command |
|------|---------|
| 1. Start ingest | `bun run dev:ingest` (requires `--test-scheduled` in worker dev script) |
| 2. M1 proof matrix | `bun run twitch:freeze-proof` |
| 3. Full verify gate | `bun run verify:twitch` (no skip env) |
| 4. Optional deep poll | `bun run twitch:checkpoint:full` |

`twitch:freeze-proof` runs: `GET /health` → `d1:verify-schema` (local) → `ingest:cron` → `twitch:checkpoint --no-start-ingest` → optional `scripts/ingest/eventSub-local-proof.ts` when `TWITCH_EVENTSUB_SECRET` (10–100 chars, Twitch `transport.secret`) + `TWITCH_EVENTSUB_CALLBACK_URL` are set and valid in `.dev.vars`. Short/placeholder secrets **skip** EventSub proof (matrix stays green); sync code validates length before Helix. Exits non-zero on any failure.

**M1 proof run (2026-06):** `twitch:freeze-proof` **5/5 PASS**; `verify:twitch` **6/6 PASS** (run sequentially on one ingest — avoid parallel verify + checkpoint exhausting workerd ports).

### M2 — Production deploy prep

| Step | Command / doc |
|------|----------------|
| Apply remote migrations | `bun run d1:migrate:remote` (from `workers/ingest`) |
| Verify remote schema | `bun run d1:verify-schema:remote` |

**M2 attempt (2026-06-03):** Wrangler authenticated. `bun run d1:migrate:remote` → `✅ No migrations to apply!` (remote already at head). `bun run d1:verify-schema:remote` → **PASS** (11 tables, through 0008).
| Sync secrets | `wrangler secret put TWITCH_CLIENT_ID` … `ADMIN_API_KEY` — [15](./15-ingest-runbook.md) |
| Production vars | Deploy ingest with `--env production` (60/20 thresholds) |
| Dry-run checklist | [11-cloudflare-deployment](./11-cloudflare-deployment.md), [15 § deploy](./15-ingest-runbook.md) |

### M3 — EventSub prod proof

| Step | Checklist |
|------|-----------|
| Public HTTPS callback URL | Worker route `/webhooks/twitch/eventsub` reachable from Twitch |
| `TWITCH_EVENTSUB_SECRET` | Set in production via `wrangler secret put` — **10–100 characters** (not client secret) |
| Subscription sync | `bun run twitch:eventsub-sync` against prod (with admin header) |
| Twitch dashboard | Subscriptions show `enabled`; test `stream.online` / `stream.offline` |
| Proof command (local only) | `bun run twitch:eventsub-sync` + `workers/ingest/test/eventsub-*.spec.ts` |

**Matrix row stays NEEDS_PROOF until prod callback verified** — see [24 § EventSub](./24-remediation-grounding-audit.md#twitch-phase-02-operational-matrix).

### M4 — Legal / launch shell

| Item | Status | Action |
|------|--------|--------|
| `/privacy`, `/terms` stubs | [x] Shipped (REM-023) | Attorney review before public beta ([18](./18-legal-and-compliance-checklist.md)) |
| `/methodology` | [x] Shipped | REM-024 |
| Footer attribution | [x] | `AppShell` → `Footer.svelte` on root layout; disclaimer expanded (Twitch/Kick/YouTube trademarks) |
| Contact / support route | [x] | `/support` — mission, contact mailtos, development, no-paywall (doc 18 structure) |
| Cookie banner (if analytics) | [ ] Deferred until GA/GTM |

### M5 — Freeze sign-off → Kick (ADR-003)

1. All G1–G12 boxes checked (maintainer sign-off on [24 matrix](./24-remediation-grounding-audit.md)).
2. Update ROADMAP Phase 3 prerequisite bullet to “complete”.
3. Begin Kick ingest per [ADR-003](./adr/0003-kick-ingest-strategy.md) — no Kick cron implementation before M5.

---

## 3. Work queue (next 15 tasks)

| # | Task | Owner | Effort | Depends | REM / doc |
|---|------|-------|--------|---------|-----------|
| 1 | ~~Run M1 proof locally~~ | ops | — | — | **Done** 2026-06 — `twitch:freeze-proof` 5/5 |
| 2 | ~~Run full `verify:twitch` locally~~ | ops | — | — | **Done** — G1 |
| 3 | ~~Apply remote D1 migration `0006`~~ | ops | — | — | **Done** — REM-003, G2 |
| 4 | ~~`d1:verify-schema:remote` pre-deploy~~ | ops | — | — | **Done** 2026-06-03 |
| 5 | Production deploy ingest (`--env production`) | ops | M | #3–4 | REM-002, G3 |
| 6 | `wrangler secret put` TWITCH_* + ADMIN_API_KEY (prod) | ops | S | #5 | REM-001, [15](./15-ingest-runbook.md) |
| 7 | EventSub prod callback + sync proof | ingest/ops | M | #5–6 | M3, [24 EventSub](./24-remediation-grounding-audit.md) |
| 8 | Pages deploy + D1 binding smoke | ops/web | S | #5 | [11](./11-cloudflare-deployment.md) |
| 9 | Legal attorney review of `/privacy`, `/terms` | docs | M | REM-023 | G8, [18](./18-legal-and-compliance-checklist.md) |
| 10 | Footer platform attribution audit | web | S | — | doc 18 |
| 11 | Mark doc 24 matrix G12 complete (maintainer) | ops | S | #1–7 | G12 |
| 12 | ROADMAP Phase 3 gate sign-off | docs | S | G1–G12 | REM-029, G11 |
| 13 | ~~OpenAPI lint in CI~~ | ops | S | — | **Done** — REM-034 |
| 14 | ~~Playwright smoke non-blocking CI~~ | web | M | ingest seed optional | **Done** — REM-035 |
| 15 | Kick ADR-003 implementation kickoff | ingest | L | M5 | Phase 3, [ADR-003](./adr/0003-kick-ingest-strategy.md) |

---

## 4. Zero-WARN / no slop rules

From [24 § Zero-WARN](./24-remediation-grounding-audit.md#zero-warn-policy-twitch-freeze) and [25 § Zero-WARN](./25-dependency-and-api-grounding.md#zero-warn-policy):

| Rule | Enforcement |
|------|-------------|
| Matrix rows | **OPERATIONAL** only when code + tests + proof command pass; **NEEDS_PROOF** for operator-only (remote D1, prod EventSub, prod deploy) |
| **BLOCKED** | Missing implementation or failing gate — fix before Kick |
| Dependency **NEEDS_REVIEW** | Must close with fix or test proof ([25 checklist](./25-dependency-and-api-grounding.md#needs_review-closure-checklist)) |
| Helix claims | Cite [Get Channel Followers](https://dev.twitch.tv/docs/api/reference#get-channel-followers) — `total` only, no invented history API |
| Admin in prod | Unset `ADMIN_API_KEY` → 503 fail-closed |
| No mock in user path | Empty/unavailable UI when ingest down (REM-036) |
| Proof over narrative | Prefer `bun run twitch:freeze-proof`, `verify:twitch`, spec files over manual curl chains ([AGENTS.md](../AGENTS.md)) |

---

## 5. Research sources

| Source | Use for | Notes |
|--------|---------|-------|
| **Exa MCP** (`web_search_exa`, `web_fetch_exa`) | Twurple 8.x, Playwright E2E patterns, Helix pagination | Rate limits possible; prefer official URLs in citations |
| **Context7 MCP** | Library/framework API lookups | Quota may block; fallback WebFetch |
| **Twurple reference** | Helix call mapping (not installed) | [twurple.js.org](https://twurple.js.org/) — see [21](./21-twitch-ingest-libraries.md) |
| **Helix direct** | Source of truth for ingest | [dev.twitch.tv/docs/api](https://dev.twitch.tv/docs/api/reference) — repo `helix.ts` |
| **Cloudflare docs** | D1, Queues, Cron, Secrets, Vitest pool | [developers.cloudflare.com](https://developers.cloudflare.com/workers/) — MCP may 401; use WebFetch |
| **Repo** | Specs, wrangler.jsonc, scripts | `workers/ingest/test/`, `scripts/verify/twitch-e2e-verify.ts` |

---

## Verification quick reference

```bash
# Terminal 1
bun run dev:ingest

# Terminal 2 — M1 proof matrix
bun run twitch:freeze-proof

# Full gate (tests + checkpoint + build)
bun run verify:twitch

# Deep coverage poll (slow)
bun run twitch:checkpoint:full

# Pre-deploy remote schema
bun run d1:verify-schema:remote
```

See [13-testing-and-verification.md](./13-testing-and-verification.md).
