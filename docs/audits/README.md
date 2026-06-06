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

## Phase 3 sign-off

| Doc | Role |
|-----|------|
| [phase3-signoff](./phase3-signoff.md) | MVP complete checklist — gates, parity matrix, ops deferrals (2026-06-05) |

## Phase 4 sign-off

| Doc | Role |
|-----|------|
| [phase4-signoff](./phase4-signoff.md) | Retention & agency complete — gates, slices 4.1–4.7 (2026-06-05) |

## Phase 5 kickoff

| Doc | Role |
|-----|------|
| [phase5-execution-plan](./phase5-execution-plan.md) | Cloudflare prod deploy — ordered slices 5.0–5.6, agent vs operator split, P1–P7 pre-deploy gates (2026-06-05) |

## Phase 3–4 code review (2026-06)

MCP-grounded audits — findings only; remediation tracked separately.

| Doc | Role |
|-----|------|
| [phase3-4-review-executive-summary](./phase3-4-review-executive-summary.md) | Rollup + remediation status (Agents 1–5) |
| [phase3-4-remediation](./phase3-4-remediation.md) | Finding → fix mapping with citations |
| [phase3-4-review-agent1-kick-youtube](./phase3-4-review-agent1-kick-youtube.md) | Kick + YouTube ingest — 1 P0 session-key split |
| [phase3-4-review-agent2-web-phase3](./phase3-4-review-agent2-web-phase3.md) | Phase 3 browse UI — Svelte MCP + parity H1–H8 |
| [phase3-4-review-agent3-ingest-phase4](./phase3-4-review-agent3-ingest-phase4.md) | R2, 90d, VOD, watchlist |
| [phase3-4-review-agent4-web-packages-phase4](./phase3-4-review-agent4-web-packages-phase4.md) | Compare, CSV, language filter |
| [phase3-4-review-agent5-cross-cutting](./phase3-4-review-agent5-cross-cutting.md) | json-guards, verify, oxlint |

## Phase 4

| Doc | Role |
|-----|------|
| [28-phase4-plan](../28-phase4-plan.md) | Vertical slices — CSV export 4.1 shipped |
| [phase4-remediation](./phase4-remediation.md) | P0/P1 fixes post-audit (2026-06-05) |
| [gitnexus-phase2-4-audit](./gitnexus-phase2-4-audit.md) | GitNexus trace audit Phase 2–4 flows + gates (2026-06-05) |

## Phase 3 audit wave 2 deferred

Document only — not blockers for wave 3 re-audit when code gates pass:

| Item | Notes |
|------|--------|
| Prod `*/2` multi-platform cron | Enable after 14-day ingest budget gate ([15-ingest-runbook](../15-ingest-runbook.md#kick--youtube-cron)) |
| Staging/prod shared D1 id | Ops: separate `database_id` per env in wrangler/Pages bindings |
| Full YouTube discover cron | Tracked UC catalog + admin bootstrap only; no `search.list` cron |
| Full health multi-platform | `/health?detailed=1` Twitch-heavy until stretch |
