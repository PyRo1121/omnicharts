# Phase 5 execution plan (Cloudflare production)

**Date:** 2026-06-05  
**Audience:** Agents + operators deploying public beta  
**Related:** [ROADMAP Phase 5](../../ROADMAP.md#phase-5--cloudflare-production-weeks-1518) · [11-cloudflare-deployment](../11-cloudflare-deployment.md) · [15-ingest-runbook](../15-ingest-runbook.md) · [23-paid-tier-zero-overage-playbook](../23-paid-tier-zero-overage-playbook.md) · [14-observability-slos](../14-observability-slos-and-error-budgets.md)

**Prerequisite sign-offs:** [phase3-signoff](./phase3-signoff.md) · [phase4-signoff](./phase4-signoff.md)

---

## Goal

Public beta on Cloudflare: Pages (read) + ingest Worker (write) on **Workers Paid**, shared D1 through migration **0010**, health SLOs met, custom domain optional.

**Exit criteria (ROADMAP):** Public beta; ingest lag p95 &lt; 5 min.

---

## Agent vs operator split

| Who | Can do without user paste |
|-----|---------------------------|
| **Agent (local)** | `bun run lint`, `bun run check:web`, `bun run verify:wrangler-production`, `bun run d1:verify-schema` (local), full `verify:twitch` with `dev:ingest` |
| **Agent (Cloudflare auth)** | `wrangler login` session → `d1:migrate:remote`, `d1:verify-schema:remote`, `wrangler deploy`, `wrangler secret put` from `workers/ingest/.dev.vars` |
| **Operator / account** | Workers Paid upgrade, D1/R2/Queues provisioning, custom domain DNS, Pro zone plan if WAF needed |

**Policy:** Agents sync secrets from `workers/ingest/.dev.vars` — never ask user to paste values ([15-ingest-runbook](../15-ingest-runbook.md#local-twitch-credentials)). Do **not** edit `wrangler.jsonc` bindings/crons unless doc explicitly requires ([23-paid-tier](../23-paid-tier-zero-overage-playbook.md) §4 is SSOT for prod vars).

---

## Pre-deploy gates (no Cloudflare secrets)

Run from repo root before any remote deploy:

| # | Gate | Command | Expected |
|---|------|---------|----------|
| P1 | Lint | `bun run lint` | 0 errors |
| P2 | Format | `bun run format:check` | clean |
| P3 | Web types | `bun run check:web` | pass |
| P4 | Ingest unit | `bun run test:ingest` | all pass |
| P5 | Local D1 schema | `bun run d1:verify-schema` | through **0010** |
| P6 | Prod wrangler vars | `bun run verify:wrangler-production` | 60m airtime, 20 min viewers |
| P7 | Twitch E2E (local) | `bun run dev:ingest` → `bun run verify:twitch` | pass |

---

## Ordered deploy checklist

**Order:** account prep → schema → secrets → ingest → Pages → smoke → SLO watch.

### Slice 5.0 — Account & bindings (operator)

- [ ] Cloudflare account on **Workers Paid** ([ADR-004](../adr/0004-cloudflare-free-vs-paid.md))
- [ ] D1 database `omnicharts` exists; `database_id` in `apps/web/wrangler.jsonc` + `workers/ingest/wrangler.jsonc` (staging vs prod **separate ids** — [11](../11-cloudflare-deployment.md))
- [ ] Queues `omnicharts-ingest` + `omnicharts-ingest-dlq` created ([19](../19-project-scaffold-and-commands.md))
- [ ] R2 bucket `omnicharts-samples` (cold archive off until budget sign-off — [23](../23-paid-tier-zero-overage-playbook.md))
- [ ] `bunx wrangler login` (agent or operator)

### Slice 5.1 — Remote D1 migrate **0010** (agent, needs login)

- [ ] `bun run d1:migrate:remote` — applies through `0010_twitch_vod_metadata.sql`
- [ ] `bun run d1:verify-schema:remote` — parity through **0010** ([13-testing](../13-testing-and-verification.md))

### Slice 5.2 — Secrets sync (agent, needs login + local `.dev.vars`)

From `workers/ingest`, for each key in `.dev.vars` (non-empty):

| Secret | Required for |
|--------|----------------|
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Helix discover/poll |
| `TWITCH_EVENTSUB_SECRET`, `TWITCH_EVENTSUB_CALLBACK_URL` | EventSub webhooks |
| `ADMIN_API_KEY` | Mutating `/admin/*` |
| `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` | Kick poll/discover |
| `KICK_WEBHOOK_PUBLIC_KEY` | Kick webhooks (optional) |
| `YOUTUBE_API_KEY` | YouTube tracked poll |

```bash
cd workers/ingest
printf '%s' "$VALUE" | npx wrangler secret put KEY
```

- [ ] All production secrets synced (agent parses `.dev.vars`; no user paste)
- [ ] `GET /health` after deploy shows `twitch` = `configured` (and kick/youtube when keys set)

### Slice 5.3 — Deploy ingest Worker (agent)

- [ ] Confirm `env.production.vars` unchanged vs [23](../23-paid-tier-zero-overage-playbook.md) §4 (`INGEST_COVERAGE_MODE=full`, `cpu_ms=30000`, etc.)
- [ ] `cd workers/ingest && npx wrangler deploy --env production` (or default prod env per repo config)
- [ ] `GET /health` — `ingest_lag_seconds.twitch` &lt; 120s after first poll cycle
- [ ] `GET /health?detailed=1` + `X-Admin-Api-Key` — queue depth, rollup timestamp

**Deferred until budget gate:** production `*/2` multi-platform cron ([15-ingest-runbook](../15-ingest-runbook.md#kick--youtube-cron)). Do not uncomment without [23](../23-paid-tier-zero-overage-playbook.md) sign-off.

### Slice 5.4 — Deploy Pages (agent)

- [ ] `cd apps/web && bun run build`
- [ ] `npx wrangler pages deploy .svelte-kit/cloudflare --project-name=omnicharts-web`
- [ ] Spot-check `/`, `/channels`, `/compare`, `/methodology`
- [ ] Rankings SSR uses prod vars (`TWITCH_MIN_VIEWERS=20`, 60m airtime)

### Slice 5.5 — Health SLO verification (agent + operator)

Per [14-observability-slos](../14-observability-slos-and-error-budgets.md):

| SLI | Target | Check |
|-----|--------|-------|
| Ranking freshness | p95 lag &lt; 5 min | `ingest_lag_seconds` + homepage data age |
| Ingest coverage | ≥ 95% tracked live / 2 min | `/health?detailed=1` after 24h |
| Pages availability | 99% monthly | Cloudflare analytics (post-launch) |

- [ ] `/health` returns `status: ok` (degraded if any platform lag &gt; 300s)
- [ ] `GET /v1/rankings/channels?platform=twitch&period=7d&limit=5` — non-empty when ingest healthy
- [ ] No `POST /admin/dev/*` in production (404 unless `ALLOW_DEV_SEED=1`)

### Slice 5.6 — Public beta & domain (operator)

- [ ] Custom domain on Pages project
- [ ] Legal placeholders resolved ([18-legal](../18-legal-and-compliance-checklist.md)) before marketing
- [ ] Optional: Cloudflare Pro ($20/zone) for WAF — not required for D1 headroom ([23](../23-paid-tier-zero-overage-playbook.md))

---

## What agents do next (no user secrets)

1. Keep **P1–P7** green on every PR touching ingest/web.
2. Maintain this doc + [ROADMAP](../../ROADMAP.md) checkboxes as slices complete.
3. When `wrangler login` + `.dev.vars` exist locally: run **5.1 → 5.3** without user involvement.
4. Fix doc drift (e.g. deploy checklists referencing old migration heads).
5. **Do not** change `wrangler.jsonc` crons/bindings for Phase 5 kickoff unless [23](../23-paid-tier-zero-overage-playbook.md) or [11](../11-cloudflare-deployment.md) explicitly requires it.

---

## Blocked on Cloudflare credentials / account

| Blocker | Unblocks |
|---------|----------|
| No Workers Paid | Minute-level `INGEST_COVERAGE_MODE=full` ingest |
| No `wrangler login` | Remote migrate, deploy, secret put |
| Missing `.dev.vars` locally | Agent secret sync (file must exist; values gitignored) |
| Shared staging/prod D1 id | Separate databases per env |
| `*/2` cron disabled | Kick/YouTube poll cadence in prod (budget gate) |
| `COLD_ARCHIVE_ENABLED=0` | R2 Parquet cold path in prod (Phase 4.3 opt-in) |

---

## Verification log

| Date | Gate | Result | Notes |
|------|------|--------|-------|
| 2026-06-05 | Phase 5 plan authored | — | Pre-deploy slices 5.0–5.6; P1–P7 runnable locally |
| | Remote D1 **0010** | pending | Re-run after Phase 4 shipped VOD migration |
| | Prod deploy | pending | Requires Workers Paid + login |

---

## Related audits

- [cloudflare-hardening-complete](./cloudflare-hardening-complete.md) — current CF checklist
- [ingest-d1-query-audit](./ingest-d1-query-audit.md) — write budget
- [26-twitch-freeze-execution-plan](../26-twitch-freeze-execution-plan.md) — G2/G3 gates (extend to 0010)
