# Channel discovery and tracking

Canonical spec for which channels exist in OmniCharts and how they enter the ingest loop. Complements [05-ingestion-per-platform.md](./05-ingestion-per-platform.md).

---

## State machine

```
discovered → tracked → dormant → retired
```

| State | Meaning | Poll cadence |
|-------|---------|--------------|
| `discovered` | Seen in directory/top lists; metadata only | None |
| `tracked` | Eligible for live sampling | 60s (Twitch live), 120s (YouTube) |
| `dormant` | No live in 30 days | 24h liveness check |
| `retired` | Platform ID 404 / banned | None; keep rollups |

**Single field:** use `ingest_state` only (drop separate `is_tracked` boolean).

### Promotion rules

| From | To | Condition |
|------|-----|-----------|
| `discovered` | `tracked` | Channel appeared live ≥2 times in 14d **or** manual seed **or** in top-N game directory |
| `tracked` | `dormant` | No live session 30 days |
| `dormant` | `tracked` | Live detected on check |
| `*` | `retired` | API 404 on user/channel |

---

## Discovery (Twitch) — no streamer allowlist

**Primary (every 1 min cron):** **Global live sweep**

1. `GET /helix/streams` with no `user_id` / `game_id` — Twitch’s live directory, **viewer count descending**.
2. Paginate (`first=100`, `after=cursor`) until the page’s peak `viewer_count` &lt; `TWITCH_MIN_VIEWERS` (e.g. 20).
3. Upsert channel + write `viewer_samples` for every row ≥ threshold.

Implementation: `workers/ingest/src/twitch/coverage.ts` (`runTwitchCoverageCycle`). **No manual channel list.**

Each **1 min** cron runs three passes ([ADR-0006](./adr/0006-twitch-pagination-coverage.md)):

1. **Global sweep** — `sweep.ts`
2. **Game pass** — 5 rotating top games (`game-pass.ts`)
3. **Reconcile** — `user_id` lookup for channels active in last 3h (`reconcile.ts`)

Twitch’s live list is **dynamic**; duplicates across pages are normal. Union + reconcile maximizes recall; EventSub (Phase 1b) adds lifecycle edges.

**Helix budget @ 20+ viewers:** typically **~50–90 points** per cycle — far under **800 points/min** ([API guide](https://dev.twitch.tv/docs/api/guide#pagination)).

**Supplemental (every 6h):** full top-games discovery (`discover.ts`) — `game_categories` + deep game pagination.

**Optional backfill:** `POST /admin/twitch/poll-catalog` re-polls known `tracked` IDs by `user_id` (legacy path; not required for discovery).

**Do not** cron-scrape third-party tracker sites. **Do not** attempt offline catalog of every Twitch account ever created.

---

## MVP tracking caps (solo dev)

Aligns with API quotas in [05-ingestion-per-platform.md](./05-ingestion-per-platform.md).

| Platform | Catalog rows | Live set polled | Poll interval |
|----------|--------------|-----------------|---------------|
| Twitch | 1,500 – 3,000 | 200 – 800 | 60s |
| Kick | 300 – 800 | 50 – 200 | 60–120s |
| YouTube | 150 – 350 | 40 – 120 | 120s |

Increase caps only after rollup CPU and D1 write budget measured on Cloudflare Paid.

---

## Viewer threshold (product)

| Knob | Launch (v1) | Later |
|------|-------------|-------|
| **Track + sample** (`TWITCH_MIN_VIEWERS`) | **20** concurrent viewers when seen live | 10 → 2 as infra allows |
| **Public rankings** (rollup gate) | Same as track threshold initially | Can stay ≥2 for “emerging” lists if desired |

**Why 20 first:** Cuts long-tail noise (most live streams are 0–5 viewers), keeps poll + D1 sample volume manageable, still covers the vast majority of **hours watched** (power-law: mid+ channels dominate HW). Comparable sites use similar floors (SullyGnome: 3–10+; Streams Charts API docs: **2+** average viewers for indexing).

**Rough scale at 20+ (order of magnitude, varies by time of day):**

| Metric | Typical range |
|--------|----------------|
| Live channels ≥20 viewers | ~1.5k–4k concurrent (not ~30k total lives) |
| Helix poll cost @ 60s | ~15–40 points/min (batches of 100) — well under 800/min |
| Discovery | Top games + stop paginating when page peak &lt; `TWITCH_MIN_VIEWERS` |

**Coverage gap to close over time:** Long-tail **games outside** `DISCOVERY_GAMES_TO_SCAN` may host 20+ streams. Mitigations: raise game scan count, or a low-frequency global `GET /streams` sweep until pages drop below threshold (~50–80 Helix calls per sweep).

Set in Worker env: `TWITCH_MIN_VIEWERS=20`, `TWITCH_MAX_TRACKED=5000` (see `workers/ingest/.dev.vars.example`).

---

## Ranking eligibility

A channel appears in **public rankings** when:

1. `ingest_state = 'tracked'`
2. Sum of airtime in period ≥ **60 minutes** (configurable)
3. Period average viewers ≥ **track threshold** (20 at launch; configurable)

Channels below threshold may still have a **profile page** with “insufficient data” copy.

---

## Edge cases

| Case | Handling |
|------|----------|
| Slug rename | `slug_history` table; 301 old → new |
| Simulcast Twitch+Kick | Two channel rows; no merged HW |
| 24/7 “always live” | Cap samples per day; flag `always_on` for review |
| Rerun / marathon streams | Attribute HW to session; game from session start |
| Raid inflation | MVP: include in HW; Phase 4+ optional exclude flag |

---

## YouTube discovery constraint

- **Never** cron `search.list` (100 units/call).
- Bootstrap channel IDs once; maintain `live_video_id` per channel.
- Steady-state: `videos.list` only ([05](./05-ingestion-per-platform.md)).

---

## Kick discovery

**Constraints:** No global live directory. Max **100** streams per `livestreams` query; **50** `broadcaster_user_id` per poll batch.

### Seeds

1. **Category leaderboard** (every 6h): `GET /public/v2/categories` → `GET /livestreams?category_id=&sort=viewer_count&limit=100` → `discovered` rows.
2. **Slug resolve:** `GET /public/v1/channels?slug=` for search UX.
3. **Optional webhook:** `livestream.status.updated` — not required for discovery.

### Promotion (Kick)

Same global rules as Twitch; category top-100 snapshot counts as promotion signal.

### Caps

| Catalog | Live polled | Interval |
|---------|-------------|----------|
| 300–800 | 50–200 | 60–120s |

Register: [dev.kick.com](https://dev.kick.com/) — [ADR-003](./adr/0003-kick-ingest-strategy.md).

---

## Implementation checklist

- [x] Discovery cron separate from sample cron (`0 */6 * * *` → `discover_twitch`)
- [x] Metrics: `tracked_channels`, `ingest_state_counts` on `GET /health`
- [x] Admin view: `/dev/ingest` + health JSON (`ingest_state_counts.twitch`)
- [x] `channels_live`, `discovery_new_24h`, `ingest_lag_seconds.twitch` on `GET /health`
- [x] `tracked` → `dormant` after 30d without `last_seen_at` (daily rollup hook)
- [x] `*` → `retired` when Helix user missing during profile enrich
- [x] `slug_history` on slug change in `upsertChannelFromStream`
- [x] `discovered` → `tracked` after ≥2 qualifying live sightings in 14d (`channel_live_sightings`); dormant → tracked on next live
- [x] `GET /v1/rankings/games` (game rollups + `game_categories`)
