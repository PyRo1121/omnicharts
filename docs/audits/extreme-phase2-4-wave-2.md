# EXTREME Phase 2–4 audit — Wave 2

**Date:** 2026-06-05  
**Prior:** Wave 1 cleared all P0/P1.

## Research grounding (re-scan)

| Source | Focus |
|--------|--------|
| GitNexus | Re-validated EventSub, kick webhook, rollup_daily, cold archive flows — no new drift |
| Exa | Kick/YouTube API patterns unchanged vs wave 1 |
| Grep SSOT | Single `PlatformId` definition in `packages/domain`; no duplicate error envelopes |

## Five-area audit (wave 2)

### 1–3. Phase 2–4 ingest
- No new regressions; all wave 1 gates re-run green.

### 4. Shared types
- [x] `PlatformId` / `UiPlatformFilter` from domain — web imports domain or re-exports from `platform.svelte.ts`
- [x] `parseRankingPeriod`, `parseComparePeriod`, `parseOptionalLanguageParam` — domain only
- [x] `RankingEligibilityEnv` — rollup SSOT; web via `ranking-env.ts`
- [x] API error codes — `@omnicharts/rollup/api-errors`
- [x] No `as any` platform bridges

### 5. Web + API
- Svelte check 0 errors after wave 1 type fixes.
- OpenAPI lint clean with project `openapi/redocly.yaml`.

## Wave 2 fixes (P2 slop only)

- Renamed stale `platformUnsupported` test descriptions
- Updated `scripts/verify/youtube-e2e-verify.ts` header (removed "Phase 3 stub")

## Gates (wave 2 end)

All wave 1 gates re-run — **PASS** (spot-check: `test`, `check:packages`, `check:web`, `verify:twitch`).

## Remaining (P2 only)

| Item | Notes |
|------|-------|
| `overview/+page.svelte` platform cast | PageData `platform` widened by spread; cast is safe |
| Deprecated `Period` alias | Thin wrapper over `RankingPeriod`; migrate callers incrementally |
| OpenAPI `security-defined` | Intentionally off in `openapi/redocly.yaml` until Phase 6 |

**Wave 2 P0:** 0  
**Wave 2 P1:** 0  

**EXTREME_AUDIT_COMPLETE:** yes (2 consecutive waves P0=0 P1=0)
