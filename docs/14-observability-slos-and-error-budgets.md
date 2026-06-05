# Observability, SLOs, and error budgets

---

## Service level objectives (beta)

| SLI | Target | Measurement |
|-----|--------|-------------|
| Ranking freshness | p95 lag **&lt; 5 min** from sample to rollup visible | `now - rankings_updated_at` |
| Ingest coverage (tracked live) | **≥ 95%** of `tracked`+live channels get ≥1 sample per 2 min window | missed / expected |
| Pages availability | **99%** monthly | Cloudflare analytics |
| D1 query p95 (homepage) | **&lt; 200 ms** | Workers trace |

---

## Error budgets

| Budget | Allowance | Action when exhausted |
|--------|-----------|------------------------|
| Missed sample windows | 5% of channel-minutes/day | Shed `dormant` tier; alert |
| Platform 429 minutes | 30 min/day per platform | Exponential backoff; reduce poll rate |
| Ranking stale | 15 min continuous | Page banner “data delayed” |

---

## Metrics to emit

### Ingest Worker

| Metric | Type | Labels |
|--------|------|--------|
| `ingest_lag_seconds` | gauge | platform |
| `samples_written_total` | counter | platform |
| `poll_errors_total` | counter | platform, http_status |
| `queue_depth` | gauge | queue_name |
| `d1_rows_written` | counter | — |

### Pages

| Metric | Type |
|--------|------|
| `page_load_ms` | histogram |
| `d1_query_ms` | histogram |

---

## Health endpoint

`GET /health` (ingest Worker or Pages):

```json
{
  "status": "ok",
  "ingest_lag_seconds": { "twitch": 42, "kick": 120, "youtube": 90 },
  "last_rollup_at": "2026-06-01T00:15:03Z",
  "tracked_channels": { "twitch": 2100, "kick": 400, "youtube": 200 }
}
```

`status: degraded` if any platform lag &gt; 300s.

---

## Logging

- Structured JSON: `{ "level", "msg", "platform", "batch_id", "duration_ms" }`
- No PII in logs (no chat messages)
- `waitUntil()` for async log flush from Pages

---

## Alerting (manual at first)

| Alert | Condition |
|-------|-----------|
| Ingest down | lag &gt; 15 min for 10 min |
| D1 write limit | Cloudflare dashboard 80% daily |
| Queue DLQ | any message in DLQ |

---

## Dashboards

Phase 5: Workers Analytics + custom chart of `ingest_lag_seconds`.

Phase 1 local: dev admin page reading SQLite `ingest_runs` table (optional).

---

## Competitive smoke test (quality)

Weekly script (Phase 2+):

- Compare top 10 Twitch HW (7d) vs public SullyGnome/Streams Charts
- **Tolerance:** order-of-magnitude (same channels in top 20, not exact integers)
- Fail CI if ingest coverage &lt; 90% for seed list

Document methodology — do not assert numeric parity with closed warehouses.
