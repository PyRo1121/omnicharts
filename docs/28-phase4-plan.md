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
| **4.2** | **90-day rollups + UI `90d` toggle** | 90-day retention | D1 rollup job |
| **4.3** | **R2 Parquet cold archive** | R2 cold path | 4.2 |
| 4.4 | 2-channel compare (7d/30d/90d) | Compare Streamers | Browse MVP |
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

## Slice 4.2 — 90-day rollups (shipped 2026-06-05)

- `rollup_daily` prunes `channel_daily_rollups` / `game_daily_rollups` older than **90 days** (`workers/ingest/src/db/prune-rollups.ts`)
- Rankings + channel/game detail APIs already accept `period=90d`; web `PeriodSelector` exposes `90d`
- Honest `periodNote` when rollup coverage is shorter than the selected window (`periodCoverageNote` + `getRollupCoverageDays`)

## Slice 4.3 — R2 Parquet cold archive (shipped 2026-06-05)

- After each `rollup_daily`, `runRetentionWithColdArchive` archives rows past the hot window to R2 **Parquet** before delete (`workers/ingest/src/db/cold-archive.ts`, `workers/ingest/src/r2/cold-archive.ts`)
- **Samples:** 14d hot in D1 → `samples/year=YYYY/month=MM/day=DD/platform={platform}/part-{uuid}.parquet`
- **Rollups:** 90d hot in D1 → `rollups/year=YYYY/month=MM/kind=channel_daily|game_daily/part-{uuid}.parquet`
- Master switch: `COLD_ARCHIVE_ENABLED=1` (default **0** in wrangler); uses existing `SAMPLES` R2 binding
- Live poll NDJSON archive (`SAMPLE_ARCHIVE_ENABLED`) unchanged — orthogonal path
- Offline reads: DuckDB `read_parquet` on laptop — not Workers request path

## Slice 4.4 — 2-channel compare (shipped 2026-06-05)

- Route `/compare?a={slug}&b={slug}&platform=&period=7d|30d|90d` — side-by-side rollup metrics (HW, AV, peak, airtime)
- `loadChannelCompare` parallel rollup reads via existing channel detail path — no sample scans
- Honest empty: missing slug params, `not_found`, `discovered`, zero rollup rows in period
- API: `GET /api/v1/compare/channels` (+ OpenAPI `GET /v1/compare/channels`); ingest HTTP fallback composes two channel detail calls
- Tests: `@omnicharts/domain` compare periods, `@omnicharts/rollup` compare-api, web server + API route Vitest, Playwright `e2e/compare.spec.ts`

## Slice 4.5 — Agency CSV watchlist import (shipped 2026-06-05)

- `POST /admin/watchlist/import` — admin-authed bulk promote/import (`ingest_state = tracked`)
- CSV columns: `platform,slug` (or `platform,handle`); comments (`#`) and blank lines ignored
- Per-row resolution: Twitch Helix `GET /users?login=`, Kick `GET /public/v1/channels?slug=`, YouTube on-demand `channels.list` seed
- Row outcomes: `imported`, `promoted`, `skipped`, `not_found`, `needs_api`, `error`; parse errors for invalid platform, duplicate slug, malformed rows
- Body: `text/csv` raw upload or JSON `{ "csv": "..." }`; `X-Admin-Api-Key` / Bearer per [15-ingest-runbook](./15-ingest-runbook.md)
- Tests: `watchlist-csv-parse`, `watchlist-import`, `watchlist-upsert`, `watchlist-admin-routes`, Helix `getUsersByLogins`

## Slice 4.6 — Twitch VOD metadata backfill (shipped 2026-06-05)

- `POST /admin/twitch/vod-backfill` — admin-authed Helix archive VOD metadata for tracked channels
- Tier windows from `broadcaster_type`: 7d default / 14d affiliate / 60d partner ([05-ingestion](./05-ingestion-per-platform.md))
- Persists `stream_sessions` with `backfill_source = vod`, `duration`, `view_count`; `channels.vod_backfilled_at` cursor
- Queue: `vod_backfill_twitch`; optional 6h cron when `VOD_BACKFILL_ON_DISCOVER=1` (default off)
- Helix `GET /videos?user_id=&type=archive` with existing 429 retry budget; cap `VOD_BACKFILL_MAX_CHANNELS_PER_RUN` (default 25)
- Tests: `vod-retention`, `vod-backfill`, `helix-videos`, `vod-admin-routes`, `db-vod-sessions`, `cron-messages`

## Next after 4.6

**4.7 — Language filter on rankings:** when platform API tags provide language.
