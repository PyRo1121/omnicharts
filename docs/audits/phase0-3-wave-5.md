# Phase 0–3 audit wave 5

**Date:** 2026-06-05  
**Scope:** Twitch P0–2, multi-platform ingest P3, web P0–3, API/OpenAPI, verify/CI  
**Gates:** `bun run test` · `verify:twitch` · `verify:kick` · `verify:youtube` · `d1:verify-schema` · `check:web` · `build:web` · `test:e2e` · `twitch:freeze-proof` (EventSub local proof flaky — env)

## Gate results (pre-fix)

| Gate | Result | Notes |
|------|--------|-------|
| `bun run test` | PASS | 1 flaky youtube-poll timeout on parallel run |
| `verify:twitch` | PASS | full checkpoint |
| `verify:kick` | PASS | `VERIFY_SKIP_KICK_LIVE=1` |
| `verify:youtube` | PASS | empty items ok |
| `d1:verify-schema` | PASS | 0001–0009 |
| `check:web` + `build:web` | PASS | |
| `test:e2e` | PASS | 21 pass, 5 skip (no kick creds) |
| `twitch:freeze-proof` | FAIL | EventSub local proof socket error (infra) |

## Findings (15)

| ID | Sev | Area | Issue | Fix |
|----|-----|------|-------|-----|
| W5-01 | P0 | C | Mock trending chips without `?demo=1` | `trending.ts` returns `[]` unless `mockEnabled` |
| W5-02 | P1 | D | Kick/YT rankings use `TWITCH_*` eligibility | `rankingQueryOptionsForPlatform()` |
| W5-03 | P1 | A/D | Channel SQL missing tie-break | `ORDER BY hw, av, slug` |
| W5-04 | P1 | B | `channels_live` Twitch-only | Per-platform live + sum |
| W5-05 | P1 | D | OpenAPI says YouTube empty | Updated `openapi/v1.yaml` |
| W5-06 | P1 | D | Pages BFF skips YouTube D1 | YouTube in D1 branches |
| W5-07 | P1 | C | YouTube slug_history needs ingest HTTP | D1 resolve for youtube |
| W5-08 | P1 | A | EventSub closes prior sessions at `now` | Use `event.started_at` |
| W5-09 | P1 | C | Kick/YT overview stats always `—` | Health-backed stats when live |
| W5-10 | P1 | C | `platform=all` mislabeled | Label "All (Twitch default)" |
| W5-11 | P1 | E | Verify greens on `degraded` health | Assert `status===ok` |
| W5-12 | P1 | E | Checkpoint continues on unstable health | Throw unless `CHECKPOINT_ALLOW_UNSTABLE=1` |
| W5-13 | P1 | E | Freeze-proof says 0008 not 0009 | Message updated |
| W5-14 | P1 | D | Game detail top_channels tie-break | SQL tie-break added |
| W5-15 | P1-ops | E | CI skips checkpoint by default | Documented — nightly `VERIFY_FULL=1` defer |

## Deferred (ops)

- Prod `*/2` multi-platform cron
- Remote D1 migrate / staging D1 split
- EventSub local proof network flake (not code)
- CI `VERIFY_FULL=1` nightly job (W5-15)

## Post-fix counts

- **P0 code:** 0 (W5-01 fixed)
- **P1 code:** 0 (W5-02–14 fixed)
- **P1 ops:** 4 deferred
