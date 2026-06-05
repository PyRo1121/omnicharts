# EXTREME Phase 2–4 audit — Wave 1

**Date:** 2026-06-05  
**Mandate:** ZERO mistakes; research before fix; surgical diff.

## Research grounding

| Source | Focus |
|--------|--------|
| Exa | Twitch EventSub 2026 (subscription limits, webhook verification, cost model) |
| GitNexus | `rollup_daily`, cold archive, Kick webhook, watchlist, VOD backfill hot paths |
| docs/27 | `@omnicharts/domain` + `@omnicharts/rollup` SSOT import rules |
| docs/26 | Twitch freeze gates (checkpoint, eventsub-sync) |

## Five-area audit

### 1. Phase 2 Twitch
- EventSub / Helix paths unchanged; `verify:twitch` + `twitch:freeze-proof` green with ingest up.
- No regression in freeze gates.

### 2. Phase 3 ingest (Kick/YouTube)
- Poll/webhook/seed paths indexed; `verify:kick` / `verify:youtube` green (live skipped without creds).
- `poll_platform` message type remains valid for all three platforms.

### 3. Phase 4 ingest
- Prune, R2 cold archive, watchlist, VOD migration `0010` — `d1:verify-schema` PASS through 0010.

### 4. Shared types / packages
| Finding | Sev | Fix |
|---------|-----|-----|
| `platform.svelte.ts` redefined `PlatformId` with `'all'` | P1 | Use domain `PlatformId` + `UiPlatformFilter`; `RankingPeriod` from domain |
| Duplicate `minAverageViewers` in `top-channels.ts` broke `check:packages` | P0 | Remove duplicate opt field |
| API error envelopes copied in web BFF + ingest | P1 | New `@omnicharts/rollup` `api-errors.ts` SSOT |
| `phase3UnsupportedMessage` + `platformUnsupported` dead after Phase 3 ship | P1 | Removed banner paths; simplified empty-state helpers |

### 5. Web + API
- OpenAPI CSV `description` struct error on channel detail — fixed (schema-level description).
- BFF routes now import rollup error helpers.

## Fixes applied

- `packages/rollup/src/api-errors.ts` + tests
- `packages/rollup/src/top-channels.ts` duplicate identifier
- `apps/web/src/lib/ui/platform.svelte.ts` domain type consolidation
- Removed Phase 3 unsupported UI slop across homepage/channels/games
- Web API routes + ingest `index.ts` use rollup error SSOT
- `openapi/v1.yaml` CSV description placement

## Gates (wave 1 end)

| Gate | Result |
|------|--------|
| `bun run test` | PASS |
| `bun run test:ingest:coverage` | PASS (all globs ≥80%) |
| `bun run test:web` | PASS |
| `bun run check:web` | PASS |
| `bun run check:packages` | PASS |
| `bun run build:web` | PASS |
| `bun run test:e2e` | PASS (31 passed, 6 skipped) |
| `bun run d1:verify-schema` | PASS |
| `VERIFY_SKIP_KICK_LIVE=1 bun run verify:kick` | PASS |
| `VERIFY_SKIP_YOUTUBE_LIVE=1 bun run verify:youtube` | PASS |
| `bun run verify:twitch` | PASS |
| `bun run twitch:freeze-proof` | PASS |
| `redocly lint --config openapi/redocly.yaml openapi/v1.yaml` | PASS |

## Remaining after wave 1

| ID | Sev | Item |
|----|-----|------|
| — | P2 | `overview/+page.svelte` casts `data.platform as UiPlatformFilter` (server PageData widen) |
| — | P2 | `Period` thin alias in `platform.svelte.ts` (deprecated; domain `RankingPeriod` preferred) |
| — | P2 | Stale test names / youtube verify header comment (wave 2) |

**Wave 1 P0:** 0 (after fixes)  
**Wave 1 P1:** 0 (after fixes)
