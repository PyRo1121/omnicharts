# Audits index

**Purpose:** One entry point for audit artifacts — avoid re-reading overlapping freeze docs.

| Doc | Role |
|-----|------|
| [cloudflare-hardening-complete](./cloudflare-hardening-complete.md) | **Current** CF ingest/web hardening checklist |
| [cloudflare-free-tier-audit](./cloudflare-free-tier-audit.md) | Baseline limits audit (historical) |
| [ingest-d1-query-audit](./ingest-d1-query-audit.md) | D1 write/read patterns |
| [web-performance](./web-performance.md) | Lighthouse budgets, Phase 2 web perf lane |

## Pre–Kick freeze (Twitch)

| Doc | Role — read once |
|-----|------------------|
| [23-audit-remediation-plan](../23-audit-remediation-plan.md) | REM backlog + G1–G12 criteria |
| [24-remediation-grounding-audit](../24-remediation-grounding-audit.md) | Phase 0–2 **operational matrix** (proof commands) |
| [25-dependency-and-api-grounding](../25-dependency-and-api-grounding.md) | Helix, bindings, workspace deps + toolchain pins |
| [26-twitch-freeze-execution-plan](../26-twitch-freeze-execution-plan.md) | Gate status, M0–M5 milestones, next tasks |
| [13-testing-and-verification](../13-testing-and-verification.md) | **Verify command SSOT** — no duplicate bash blocks elsewhere |

**Quick gate:** `bun run dev:ingest` → `bun run verify:twitch` (local) · `bun run twitch:freeze-proof` (M1 matrix).

## Phase 3 audit wave 2 deferred

Document only — not blockers for wave 3 re-audit when code gates pass:

| Item | Notes |
|------|--------|
| Prod `*/2` multi-platform cron | Enable after 14-day ingest budget gate ([15-ingest-runbook](../15-ingest-runbook.md#kick--youtube-cron)) |
| Staging/prod shared D1 id | Ops: separate `database_id` per env in wrangler/Pages bindings |
| Full YouTube discover cron | Tracked UC catalog + admin bootstrap only; no `search.list` cron |
| Full health multi-platform | `/health?detailed=1` Twitch-heavy until stretch |
