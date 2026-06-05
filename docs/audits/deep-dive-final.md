# OmniCharts deep dive — final audit

**Date:** 2026-06-05  
**Scope:** Phase 0–3 gates, ingest coverage (twitch/db/kick/youtube), web e2e + edge cases, P0/P1 remediation. No photon/Albion.

## Summary

| Metric | Result |
|--------|--------|
| **DEEP_DIVE_COMPLETE** | **yes** |
| Ingest gated coverage | ≥80% all metrics on twitch, db, kick, youtube |
| Unit / server tests | PASS (487 ingest + 78 web) |
| E2E | **27 passed, 6 skipped** (ingest-data probes) |
| P0 code open | 0 |
| P1 code open | 0 |

## Gate matrix

| Gate | Result | Notes |
|------|--------|-------|
| `bun run test` | PASS | domain, rollup, ingest, web |
| `bun run test:ingest:coverage` | PASS | post-run threshold script enforces ≥80% |
| `bun run check:web` | PASS | svelte-check 0 errors |
| `bun run check:packages` | PASS | `tsc -b` |
| `bun run build:web` | PASS | adapter-cloudflare |
| `bun run verify:twitch` | PASS | 6/6 (`SKIP_CHECKPOINT=1` when ingest down) |
| `bun run verify:kick` | PASS | 5/5 (`SKIP_LIVE=1`) |
| `bun run verify:youtube` | PASS | 2/2 (`SKIP_LIVE=1`) |
| `bun run d1:verify-schema` | PASS | 0001–0009 local |
| `bun run twitch:freeze-proof` | PASS | 5/5 incl. EventSub local proof |
| `redocly lint openapi/v1.yaml` | PASS | |
| `bun run test:e2e` | PASS | 27 pass / 6 skip |

## Ingest coverage (gated paths)

Enforced by `scripts/verify/check-ingest-coverage-thresholds.ts` after `vitest --coverage`.

| Path | Lines | Branches | Functions | Statements |
|------|-------|----------|-----------|------------|
| `src/twitch/` | 90.9% | 80.6% | 95.5% | 90.9% |
| `src/db/` | 97.6% | 80.1% | 96.9% | 97.6% |
| `src/kick/` | 93.1% | 80.2% | 96.5% | 93.1% |
| `src/youtube/` | 94.0% | 84.1% | 100.0% | 94.0% |

**Root cause (P0):** Vitest per-glob `thresholds` in `vitest.unit.config.mts` did not fail the run when paths were below 80%. Custom post-coverage gate now reads `coverage-final.json` and exits non-zero.

## E2E

| Suite | Pass | Skip | Fail |
|-------|------|------|------|
| smoke | 3 | 0 | 0 |
| kick-platform | 12 | 1 | 0 |
| youtube-platform | 5 | 0 | 0 |
| phase3 | 2 | 4 | 0 |
| edge-cases | 7 | 1 | 0 |
| **Total** | **27** | **6** | **0** |

**Skipped (by design):** ingest-dependent probes — kick channel/game detail, slug 301 redirect, cross-platform 404 suggestions, kick search results, ingest-down error shell (when ingest up).

**New:** `apps/web/e2e/edge-cases.spec.ts` — invalid platform fallback, 404 recovery links, methodology, platform nav, YouTube demo footnote.

**E2E harness:** Playwright `webServer` runs `wrangler d1 migrations apply omnicharts --local` before `vite dev` so platformProxy D1 schema matches ingest migrations.

## Findings fixed

| ID | Sev | Issue | Fix |
|----|-----|-------|-----|
| DD-01 | P0 | Coverage gate silent pass on sub-80% db/twitch globs | `check-ingest-coverage-thresholds.ts` + wired in `test:coverage` |
| DD-02 | P1 | `src/youtube/**` excluded from coverage gate | Added to vitest include + thresholds |
| DD-03 | P1 | db/kick/youtube branch coverage below 80% | 115 ingest test files; live-batch, poll, webhook, seed specs |
| DD-04 | P1 | `resolveChannelSlugFromHistory` uncaught D1 error → HTTP 404 rendered as 500 | try/catch + ingest HTTP fallback (same pattern as `loadChannelDetail`) |
| DD-05 | P1 | `?demo=1` ignored when platformProxy D1 bound but empty | Mock fallback when `mockEnabled && rows.length === 0` in rankings loaders |
| DD-06 | P1 | E2E assumed 404 UI headings; strict-mode text collisions | Recovery-link assertions; `.first()` on duplicate copy |
| DD-07 | P1 | Games 404 used string `error()` body | `error(404, { message })` for `+error.svelte` contract |

## Artifacts added

- `scripts/verify/check-ingest-coverage-thresholds.ts`
- `apps/web/e2e/edge-cases.spec.ts`
- Ingest tests: `db-kick-live-batch`, `db-youtube-live-batch`, `db-twitch-helpers`, `kick-api-channel-id`, `kick-rate-limit`, `kick-webhook-message-dedup`, `poll-platform-entry`, `youtube-seed`, `youtube-stream-fields`, `youtube-channel-slug`, plus extensions to existing kick/youtube/twitch specs

## P0 / P1 remaining

None in scope. Operational skips (empty kick/youtube rollups without checkpoint data) are documented in e2e skip messages, not product defects.

## Commands (reproduce)

```bash
bun run test:ingest:coverage
bun run test:e2e
bun run verify:twitch
SKIP_LIVE=1 bun run verify:kick
SKIP_LIVE=1 bun run verify:youtube
bun run twitch:freeze-proof   # requires bun run dev:ingest
```
