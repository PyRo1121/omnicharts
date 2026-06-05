# Phase 4 plan — retention & agency

**Date:** 2026-06-05  
**ROADMAP:** [Phase 4](../ROADMAP.md#phase-4--retention--agency-weeks-1114)

---

## Goals

1. Extend history depth (90d rollups, R2 Parquet cold path)
2. Agency workflows (CSV export, compare, watchlist import)
3. Deeper channel context (VOD metadata backfill, language filter when API provides tags)

---

## Vertical slices (ordered)

| # | Slice | ROADMAP item | Depends |
|---|-------|--------------|---------|
| **4.1** | **CSV export** on rankings + channel detail | CSV export (moved from Phase 6) | Phase 3 rollups |
| 4.2 | 90-day rollups + UI `90d` toggle | 90-day retention | D1 rollup job |
| 4.3 | R2 Parquet sample archive export | R2 cold path | 4.2 |
| 4.4 | 2-channel compare (7d/30d) | Compare Streamers | Browse MVP |
| 4.5 | Agency CSV watchlist import | Agency CSV import | Admin auth |
| 4.6 | Twitch VOD metadata backfill | VOD backfill | Helix tier limits |
| 4.7 | Language filter on rankings | Language filter | Platform API tags |

---

## Slice 4.1 — CSV export (shipped 2026-06-05)

**Why first:** No new retention infra; uses existing rollup responses; matches [08-auth](../08-auth-billing-entitlements.md) “CSV for everyone.”

### API

Add `format=csv` to:

- `GET /v1/rankings/channels`
- `GET /v1/rankings/games`
- `GET /v1/channels/{slug}` (daily series)

Same query params as JSON. Error `invalid_format` when not `json` or `csv`. See [07-api-spec](../07-api-spec.md) and [openapi/v1.yaml](../../openapi/v1.yaml).

### Web UI

- **Export CSV** link on `/channels` and `/channels/[slug]` (proxies `/api/v1/...?format=csv`)

### Tests

- `@omnicharts/rollup` unit tests for CSV serializers
- Web API route test for `format=csv` content-type

### Not in 4.1

- Homepage table export (defer 4.1b)
- API keys / rate limits (Phase 6)
- Game detail CSV (defer 4.1b)

---

## Next after 4.1

**4.2 — 90-day rollups:** extend `rollup_daily` window, expose `90d` in UI (currently hidden per REM-022), verify query performance on D1.
