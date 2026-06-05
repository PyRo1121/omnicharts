# Phase 4 audit remediation

**Date:** 2026-06-05  
**Scope:** Phase 4 slices 4.1–4.7 post-audit P0/P1 code fixes  
**Plan:** [28-phase4-plan](../28-phase4-plan.md)

---

## Gates (iteration 1)

| Gate | Result |
|------|--------|
| `bun run test:ingest` | PASS (569 tests) |
| `bun run test:ingest:coverage` | PASS (all globs ≥80%, incl. watchlist 96.4%) |
| `bun run test:web` | PASS (98 tests) |
| `bun run d1:verify-schema` | PASS (0001–0010) |
| `bun run check:web` | PASS |
| `bun run build:web` | PASS |

---

## P0 fixes

| ID | Issue | Fix |
|----|-------|-----|
| P0-01 | `d1:verify-schema` stopped at 0009 | Extended `verify-d1-schema.ts` through **0010** (`vod_backfilled_at`, `stream_sessions` backfill cols, `idx_channels_vod_backfill`) |
| P0-02 | Compare route ingest vs OpenAPI drift | **Pages-only** — OpenAPI documents `/api/v1/compare/channels` servers; ingest composes two channel-detail calls on BFF fallback (no ingest route) |
| P0-03 | Cold archive N× DELETE per rollup row | `cold-archive.ts` batch delete by `rowid` via `json_each` (parity with viewer_samples) |
| P0-04 | Watchlist outside coverage gate | Added `src/watchlist/**` to vitest coverage + `check-ingest-coverage-thresholds.ts` |

---

## P1 fixes

| ID | Issue | Fix |
|----|-------|-----|
| P1-01 | BFF CSV proxy dropped `Content-Disposition` | `proxy-ingest.ts`; wired on rankings/channels/games + channel detail proxy paths |
| P1-02 | Silent period default on channel/compare APIs | `parseChannelDetailQuery` + `parseCompareChannelsQuery` return `400 invalid_period` |
| P1-03 | `parseUiLanguage` subset vs domain | Uses `parseOptionalLanguageParam`; dropdown still shows `rankingLanguages` subset |
| P1-04 | Compare channel link used resolved slug | `/compare` uses `slugParam` in channel detail href |
| P1-05 | CSV export limit 100 vs table 20 | `/channels` export + `rankingsChannelsCsvUrl` default `limit=20` |
| P1-06 | Games OpenAPI `language` param | Removed from `GET /v1/rankings/games` (not implemented) |
| P1-07 | Channel rankings CSV missing `avatar_url` | Added column to `channelRankingsToCsv` + OpenAPI example |
| P1-08 | Duplicate `periodForApi` / compare period parsers | `period-api.ts` shared helper; compare uses domain `parseComparePeriod` |
| P1-09 | Watchlist admin test over-mocked | Route test exercises real `importWatchlistCsv` with Helix/upsert mocks only |
| P1-10 | Docs coverage scope stale | [13-testing](../13-testing-and-verification.md) lists all gated globs + 0010 schema |

---

## P0 / P1 remaining

| Severity | Open |
|----------|------|
| **P0** | 0 |
| **P1** | 0 |

---

## Deferred (out of scope)

- Homepage table CSV export (4.1b in [28-phase4-plan](../28-phase4-plan.md))
- Ingest-native `GET /v1/compare/channels` (Pages BFF is SSOT)
- Game detail CSV export
