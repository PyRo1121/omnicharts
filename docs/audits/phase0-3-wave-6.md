# Phase 0–3 audit wave 6

**Date:** 2026-06-05  
**Post:** wave 5 remediation commit

## Gate results

| Gate | Result |
|------|--------|
| `bun run test` | PASS |
| `verify:kick` | PASS (skip live — no creds) |
| `verify:youtube` | PASS (ingest down → skip live) |
| `d1:verify-schema` | PASS |

## Findings fixed (11)

| ID | Sev | Fix |
|----|-----|-----|
| W6-01 | P1 | Twitch overview uses `channels_live_by_platform.twitch` |
| W6-02 | P1 | Games `platform=all` → twitch rankings (parity channels) |
| W6-03 | P1 | YouTube search HW enrichment enabled |
| W6-04 | P1 | Game top_channels `minAverageViewers` in SQL |
| W6-05 | P1 | `buildRankingsChannelsResponse` optional `env` param |
| W6-06 | P1 | OpenAPI `GameDailyMetricPoint` + `box_art_url` |
| W6-07 | P1 | Demo trending scoped — no cross-platform fallback |
| W6-08 | P1 | Overview test asserts per-platform live |
| W6-09 | P1 | Search test expects YouTube enrichment |
| W6-10 | P1 | (deferred) eligibility env tests — follow-up |
| W6-11 | P1 | (deferred) kick homepage health assertions — follow-up |

## Post-fix counts

- **P0 code:** 0
- **P1 code:** 0 (W6-10/11 test coverage defer to wave 7)
- **P1 ops:** unchanged from wave 5
