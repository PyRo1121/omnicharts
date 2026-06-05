# Public API specification (v1 draft)

**Status:** Draft for Phase 6. Shapes are stable early so agencies can plan integrations.

**Base URL:** `https://api.omnicharts.com/v1` (TBD)

**Auth:** `Authorization: Bearer <api_key>` — free tier with high limits at launch.

**Format:** JSON. Errors:

```json
{ "error": { "code": "rate_limited", "message": "..." } }
```

### Error codes (implemented)

| Code | HTTP | When |
|------|------|------|
| `invalid_platform` | 400 | Search: `platform` not `twitch`, `kick`, or `youtube` |
| `invalid_query` | 400 | Search: `q` length &lt; 2 or &gt; 100 |
| `invalid_limit` | 400 | Rankings/search: bad `limit` |
| `invalid_period` | 400 | Rankings/detail: unknown `period` |
| `not_found` | 404 | Channel/game resolve or detail missing |
| `bad_request` | 400 | Missing required query param |

### Platform behavior before Phase 3 (Kick/YouTube)

| Endpoint | `platform=twitch` | `platform=kick` or `youtube` |
|----------|-------------------|------------------------------|
| `GET /v1/rankings/channels` | Rollup-backed items | `{ items: [] }` — empty, not an error |
| `GET /v1/rankings/games` | Rollup-backed items | `{ items: [] }` |
| `GET /v1/search/channels` | FTS/LIKE results | Empty `results` when ingest has no rows (Phase 3 adds data) |
| `GET /v1/channels/{slug}` | 200 or 404 | 404 until Phase 3 ingest |

No breaking change for Twitch clients. Full platform error matrix ships with Kick API (Phase 3).

---

## Rate limits (planned)

| Tier | Requests / minute | Notes |
|------|-------------------|-------|
| Public (no key) | 30 | Rankings only |
| Free API key | 300 | Registered |
| Donor (future) | 1000 | Optional |

No credit system at launch.

---

## Endpoints

### `GET /v1/rankings/channels`

Top channels by Hours Watched.

| Param | Required | Description |
|-------|----------|-------------|
| `platform` | yes | `twitch`, `kick`, `youtube` |
| `period` | no | `7d` (default), `30d`, `90d` |
| `game` | no | Filter by game slug — **Phase 6 deferred** (not in browse MVP or current `/v1`) |
| `limit` | no | max 100, default 20 |
| `offset` | no | Pagination — **Phase 6 deferred** (browse MVP returns first page only) |

**Response:**

```json
{
  "platform": "twitch",
  "period": "7d",
  "updated_at": "2026-06-01T12:00:00Z",
  "items": [
    {
      "rank": 1,
      "slug": "caedrel",
      "display_name": "Caedrel",
      "hours_watched": 2173869,
      "average_viewers": 45210,
      "peak_viewers": 120334,
      "airtime_hours": 48.1,
      "stream_count": 12,
      "tracked_since": "2026-03-15T00:00:00Z"
    }
  ]
}
```

---

### `GET /v1/rankings/games`

Top categories by Average Viewers.

Same query params except sort metric fixed to AV.

---

### `GET /v1/channels/{slug}`

Channel summary for one platform.

| Param | Required |
|-------|----------|
| `platform` | yes |
| `period` | no (`7d`, `30d`) |

**Response:** totals + daily series array for charts.

---

### `GET /v1/channels/{slug}/streams`

Paginated stream sessions in period.

---

### `GET /v1/overview`

Platform-level aggregates (matches `/overview` page).

---

### `GET /v1/search/channels`

Channel lookup for integrations. Same resolution rules as the website ([16-search-and-resolution.md](./16-search-and-resolution.md)).

| Param | Required | Description |
|-------|----------|-------------|
| `q` | yes | Query string (slug or display name) |
| `platform` | yes | `twitch`, `kick`, `youtube` |
| `limit` | no | max 25, default 10 |

---

## OpenAPI

Machine-readable spec (draft): [openapi/v1.yaml](../openapi/v1.yaml).

- Validate: `npx @redocly/cli lint openapi/v1.yaml --config openapi/redocly.yaml` (CI on every PR)
- Serve docs in Phase 6 at `/developers` via Redoc or Scalar

---

## Versioning

- Breaking changes → `/v2`.
- Additive fields allowed in `/v1`.

---

## Comparison to Streams Charts “Jazz” API

| Jazz | OmniCharts v1 |
|------|----------------|
| Credit metering | Free rate limits |
| `/api/jazz/channels/{name}` | `/v1/channels/{slug}` |
| Client-ID + Token headers | Bearer API key |
| Extra metric packs | Single JSON; advanced metrics added as fields |

Do not clone Jazz path names or auth headers.
