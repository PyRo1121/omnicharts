# Phase 3 sign-off (MVP complete)

**Date:** 2026-06-05  
**Maintainer:** agent sign-off after full gate run  
**Related:** [ROADMAP Phase 3](../../ROADMAP.md#phase-3--multi-platform-weeks-710) · [01-competitive-parity-matrix](../01-competitive-parity-matrix.md) · [26-twitch-freeze-execution-plan](../26-twitch-freeze-execution-plan.md)

---

## Shipped scope

| Area | Status |
|------|--------|
| Three-platform browse (Twitch, Kick, YouTube) | Homepage, `/channels`, `/games`, `/overview`, `/search` with `?platform=` |
| Channel + game detail pages | All three platforms (rollup-backed when ingest has data) |
| Methodology + tracked since | `/methodology`, `first_observed_at` on channels |
| 7d + 30d period toggles | Homepage + directory + detail pages |
| Kick ingest | Official API discover, poll, webhook lifecycle ([ADR-003](../adr/0003-kick-ingest-strategy.md)) |
| YouTube ingest | Tracked UC poll, seed, `youtube_live_video_id` writer |
| Platform tabs + URL state | `PlatformFilter`, sidebar nav preserves platform |

---

## Verification gates (2026-06-05)

All run from repo root with `bun run dev:ingest` up unless noted.

| Gate | Command | Result |
|------|---------|--------|
| Twitch full | `bun run verify:twitch` | **PASS** 6/6 |
| Kick | `bun run verify:kick` | **PASS** 5/5 (live discover skipped — no `KICK_*` creds in running ingest) |
| YouTube | `bun run verify:youtube` | **PASS** 2/2 |
| Unit tests | `bun run test` | **PASS** |
| Ingest coverage | `bun run test:ingest:coverage` | **PASS** (twitch, db, kick, youtube ≥80%) |
| E2E | `bun run test:e2e` | **PASS** 27 passed, 6 skipped (live-data optional) |
| Freeze proof | `bun run twitch:freeze-proof` | **PASS** 5/5 |

---

## MVP parity matrix (Phase 3 pass rule)

From [01-competitive-parity-matrix](../01-competitive-parity-matrix.md): H1–H5 + H7a + H8a/H8b + channel + game pages for **each** platform.

| # | Feature | Status |
|---|---------|--------|
| H1 | Hero value prop | Shipped |
| H2 | Platform row (Twitch, Kick, YouTube) | Shipped |
| H3 | Global channel search | Shipped |
| H4 | Most watched streamers (HW) | Shipped (per-platform; empty when no rollups) |
| H5 | Top categories (AV) | Shipped |
| H7a | Overview strip | Shipped |
| H8a | Methodology | Shipped |
| H8b | Tracked since | Shipped |
| H4b | 30d toggle | Shipped |
| H7b | Live now strip | Partial — count + link; top-5 deferred Phase 4 |
| Channel pages | `/channels/[slug]` | Shipped all platforms |
| Game pages | `/games/[slug]` | Shipped all platforms |
| Channel directory | `/channels` | Shipped |
| Game directory | `/games` | Shipped |

---

## Freeze gates G11–G12

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| G11 | Phase 3 checkbox after G1–G10 + G12 | **Signed** | This document |
| G12 | Doc 24 matrix operational | **Signed** | Code + tests green; operator proofs deferred below |

---

## Known ops deferrals (not MVP blockers)

Documented per [26 § M2–M3](../26-twitch-freeze-execution-plan.md) and [audits/README](./README.md#phase-3-audit-wave-2-deferred):

| Item | Deferral |
|------|----------|
| Production `*/2` multi-platform cron | Enable after 14-day ingest budget gate ([15 § Kick/YouTube cron](../15-ingest-runbook.md)) |
| Remote D1 re-verify at head | Re-run `d1:migrate:remote` + `d1:verify-schema:remote` before prod deploy |
| Live Kick/YouTube API credentials in prod | `KICK_CLIENT_ID`/`SECRET`, `YOUTUBE_API_KEY` via `wrangler secret put` |
| G3 prod ranking thresholds | `TWITCH_RANKING_MIN_AIRTIME_MINUTES=60`, `TWITCH_MIN_VIEWERS=20` in production vars |
| EventSub prod callback proof | M3 — matrix row NEEDS_PROOF until prod callback verified |
| Legal attorney review | `/privacy`, `/terms` stubs shipped; review pre-public-beta |

---

## Exit

**MVP complete = Phase 3 exit** per [ROADMAP](../../ROADMAP.md). Phase 4 (retention & agency) may proceed.
