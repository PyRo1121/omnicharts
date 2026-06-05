# Storage and rollup design

## Overview

| Store | Role | Dev | Production (Cloudflare) |
|-------|------|-----|-------------------------|
| SQLite file | OLTP + rollups | `./data/omnicharts.db` | — |
| DuckDB | Ad-hoc analytics, backfill validation | Local CLI | Batch Worker or local cron |
| D1 | OLTP + rollups | Wrangler local | Primary DB |
| R2 | Parquet archives, exports | MinIO optional | Cold storage |

**Rule:** UI reads **only rollups** for rankings pages; never aggregate millions of samples at request time.

---

## SQLite schema v1 (sketch)

```sql
-- platforms: seed rows twitch, kick, youtube
CREATE TABLE platforms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id),
  platform_channel_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  language TEXT,
  description TEXT,
  broadcaster_type TEXT,
  platform_created_at TEXT,
  channel_profile_json TEXT,
  profile_enriched_at TEXT,
  first_observed_at TEXT NOT NULL,
  last_seen_at TEXT,
  ingest_state TEXT NOT NULL DEFAULT 'discovered',
  UNIQUE(platform_id, platform_channel_id),
  UNIQUE(platform_id, slug)
);

CREATE TABLE game_categories (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id),
  platform_category_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(platform_id, platform_category_id)
);

CREATE TABLE stream_sessions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  platform_stream_id TEXT NOT NULL,
  title TEXT,
  game_category_id TEXT REFERENCES game_categories(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  language TEXT,
  tags_json TEXT,
  thumbnail_url TEXT,
  stream_type TEXT,
  UNIQUE(channel_id, platform_stream_id)
);

CREATE TABLE viewer_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_session_id TEXT NOT NULL REFERENCES stream_sessions(id),
  sampled_at TEXT NOT NULL,
  viewer_count INTEGER NOT NULL,
  UNIQUE(stream_session_id, sampled_at)
);

CREATE TABLE channel_daily_rollups (
  channel_id TEXT NOT NULL REFERENCES channels(id),
  date TEXT NOT NULL,
  hours_watched REAL NOT NULL,
  average_viewers REAL NOT NULL,
  peak_viewers INTEGER NOT NULL,
  airtime_minutes INTEGER NOT NULL,
  stream_count INTEGER NOT NULL,
  followers_delta INTEGER,
  PRIMARY KEY (channel_id, date)
);

CREATE TABLE game_daily_rollups (
  game_category_id TEXT NOT NULL REFERENCES game_categories(id),
  date TEXT NOT NULL,
  hours_watched REAL NOT NULL,
  average_viewers REAL NOT NULL,
  peak_viewers INTEGER NOT NULL,
  airtime_minutes INTEGER NOT NULL,
  live_channels INTEGER NOT NULL,
  PRIMARY KEY (game_category_id, date)
);

CREATE INDEX idx_channel_rollups_date_hw ON channel_daily_rollups(date, hours_watched DESC);
CREATE INDEX idx_game_rollups_date_av ON game_daily_rollups(date, average_viewers DESC);

CREATE TABLE slug_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  UNIQUE(platform_id, old_slug)
);
CREATE INDEX idx_slug_history_lookup ON slug_history(platform_id, old_slug);
```

Search index: see [16-search-and-resolution.md](./16-search-and-resolution.md) (`search_channel_fts` or prefix fallback).

---

## Rollup jobs

### Hourly (optional)

Recompute “today so far” for live channels into materialized `channel_period_rollups` cache table.

### Daily (required)

UTC 00:15: for each channel with samples yesterday:

1. Close open `stream_sessions` if offline signal received.
2. Aggregate samples → `channel_daily_rollups`.
3. Aggregate by `game_category_id` → `game_daily_rollups`.

### Ranking query (7d HW)

```sql
SELECT c.slug, c.display_name, c.avatar_url, SUM(r.hours_watched) AS hw
FROM channel_daily_rollups r
JOIN channels c ON c.id = r.channel_id
WHERE c.platform_id = ? AND r.date >= date('now', '-7 days')
GROUP BY c.id
ORDER BY hw DESC
LIMIT 100;
```

---

## DuckDB usage (local / batch)

**When:** validating backfill, generating Parquet exports, one-off agency reports.

```bash
# Example: load week of samples from Parquet
duckdb -c "SELECT channel_id, sum(viewer_count)/60.0 AS approx_hw FROM read_parquet('samples/*.parquet') GROUP BY 1"
```

Do **not** require DuckDB on Cloudflare Workers request path. Precompute into D1 instead.

---

## Cloudflare mapping

| Component | Binding |
|-----------|---------|
| SvelteKit SSR | Pages Functions or external Node build → Pages |
| Ingest worker | Worker + Cron + Queue consumer |
| Rankings API | Worker route or SvelteKit `+server` |
| Secrets | `TWITCH_CLIENT_SECRET`, `YOUTUBE_API_KEY`, etc. |

D1 limits: watch row size and DB size on free tier; prune `viewer_samples` aggressively.

---

## Migrations

- Path: `migrations/d1/` (see [11-cloudflare-deployment.md](./11-cloudflare-deployment.md)).
- **Canonical cwd:** `workers/ingest` — both ingest Worker and Pages bind the same `migrations_dir`; run `wrangler d1 migrations apply` from ingest so Wrangler resolves `../../migrations/d1` consistently.
- From repo root: `bun run d1:migrate:local` / `bun run d1:migrate:remote` (wraps `cd workers/ingest && wrangler …`).
- Verify schema after apply: `bun run d1:verify-schema` (local) or `bun run d1:verify-schema:remote` — [13-testing](./13-testing-and-verification.md).
- Local dev: same SQL against `data/omnicharts.db` if using file-backed SQLite outside Wrangler.
- Files: `0001_init_schema.sql` … `0008_ingest_hot_path_indexes.sql` (`0007` = `viewer_samples(sampled_at)`; `0008` = poll/rollup session indexes).
- **`0004_helix_stream_fields`:** `channels.language`; `stream_sessions.language`, `tags_json` (Helix `tags[]` JSON), `thumbnail_url`, `stream_type` (Helix `type`). Not stored: deprecated `tag_ids`, `is_mature`.
- **`0005_channel_profile_helix`:** Tier B — `GET /users` → `avatar_url`, `description`, `display_name`, `broadcaster_type`, `platform_created_at`; `GET /channels` → `channel_profile_json` (`game_id`, `game_name`, `title`, `tags`, `is_branded_content`). `profile_enriched_at` tracks refresh. Ingest: `runTwitchProfileEnrichment` after coverage reconcile batch, discovery cap, `POST /admin/twitch/enrich-profiles`.

**Schema conventions:**

- `ingest_state` only — no duplicate `is_tracked` flag.
- Add `slug_history` before public beta ([12-channel-discovery](./12-channel-discovery-and-tracking.md)).
- Defer `channel_period_rollups` until “today so far” cache is needed.
- Hot `viewer_samples`: **14 days** in D1; older → R2 Parquet via `runRetentionWithColdArchive` when `COLD_ARCHIVE_ENABLED=1` ([`cold-archive.ts`](../workers/ingest/src/db/cold-archive.ts)).
- Hot `channel_daily_rollups` / `game_daily_rollups`: **90 days** in D1 (Phase 4); older archived to R2 Parquet then pruned after each `rollup_daily` (Phase 4.3).

---

## Backup

| Asset | Method |
|-------|--------|
| D1 | Periodic export via Wrangler / API |
| R2 Parquet | Versioned keys `samples/year=YYYY/month=MM/...` |
