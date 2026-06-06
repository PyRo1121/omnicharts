# Ingest free-tier tuning (operator playbook)

**Audience:** DevOps / agents running OmniCharts ingest on Cloudflare **Workers Free** or staging.  
**Related:** [cloudflare-free-tier-audit](./audits/cloudflare-free-tier-audit.md) · [11-cloudflare-deployment](./11-cloudflare-deployment.md) · [ADR-004](./adr/0004-cloudflare-free-vs-paid.md) · **Paid / zero-overage:** [23-paid-tier-zero-overage-playbook](./23-paid-tier-zero-overage-playbook.md)

---

## When Free tier is enough

| Goal | Profile |
|------|---------|
| UI + rankings browse | Pages Free + ingest reads |
| Light Twitch samples (demo) | Ingest staging: `shards_only`, small catalog |
| Minute-level global coverage | **Workers Paid** — not Free |

**Do not claim 1–2 min live ingest on Free.**

---

## Environment profiles

### Local dev (`.dev.vars`)

Copy from `workers/ingest/.dev.vars.example`. Recommended defaults:

| Var | Value | Why |
|-----|-------|-----|
| `INGEST_COVERAGE_MODE` | `shards_only` | Catalog poll only — no full coverage per minute |
| `LIVE_SWEEP_MAX_PAGES` | `3` | Caps global sweep when using `sweep_only` or admin quick poll |
| `TWITCH_MAX_TRACKED` | `200` | Limits shard count (~2 queue messages/min at 100 IDs each) |
| `TWITCH_MIN_VIEWERS` | `20` | Sample gate aligned with prod discovery |

Restart `bun run dev:ingest` after editing `.dev.vars`.

### Wrangler staging (`--env staging`)

See `workers/ingest/wrangler.jsonc` → `env.staging.vars` (same caps as above).

### Production (`--env production`)

Wrangler snippet (also in `workers/ingest/wrangler.jsonc` → `env.production`):

```jsonc
"production": {
  "triggers": { "crons": ["*/1 * * * *", "15 0 * * *", "0 */6 * * *"] },
  "limits": { "cpu_ms": 30000 },
  "vars": {
    "ENVIRONMENT": "production",
    "INGEST_COVERAGE_MODE": "full",
    "TWITCH_MIN_VIEWERS": "20",
    "TWITCH_MAX_TRACKED": "3000",
    "LIVE_SWEEP_MAX_PAGES": "40",
    "TWITCH_RANKING_MIN_AIRTIME_MINUTES": "60",
    "SAMPLE_ARCHIVE_ENABLED": "0"
  },
  "queues": {
    "consumers": [{
      "queue": "omnicharts-ingest",
      "max_batch_size": 3,
      "max_batch_timeout": 5,
      "max_retries": 3,
      "dead_letter_queue": "omnicharts-ingest-dlq"
    }]
  }
}
```

| Var | Value |
|-----|-------|
| `INGEST_COVERAGE_MODE` | `full` — fan-out 2 queue messages/min (`sweep`+game pass inline, `reconcile`) |
| `ENVIRONMENT` | `production` |
| Cron | `*/1` (minute Twitch platform tick) |
| `TWITCH_MIN_VIEWERS` | `20` |
| `TWITCH_MAX_TRACKED` | `3000` |
| `LIVE_SWEEP_MAX_PAGES` | `40` (Paid budget; code default 80 if unset) |
| `TWITCH_RANKING_MIN_AIRTIME_MINUTES` | `60` |
| `SAMPLE_ARCHIVE_ENABLED` | `0` (set `1` to mirror hot samples to R2 NDJSON) |
| `SAMPLE_ARCHIVE_MIN_ROWS` | `10` — skip R2 put when batch smaller (minimize Class A ops) |

Requires **Workers Paid** + `[limits] cpu_ms` (30s) for queue consumer sweep/rollup CPU. Full baked table: [23-paid-tier-zero-overage-playbook — baked defaults](./23-paid-tier-zero-overage-playbook.md#4-knobs-to-stay-in-bundle).

---

## Coverage modes

| Mode | Cron `poll_platform` behavior | Helix / message cost |
|------|--------------------------------|----------------------|
| `full` | Fan-out: `poll_twitch_sweep` + `poll_twitch_reconcile` (game pass inline in sweep) | Paid production |
| `shards_only` | `poll_channel_batch` shards via `sendBatch` | ~8 pts/min per 800 tracked IDs |
| `sweep_only` | Single global sweep, capped by `LIVE_SWEEP_MAX_PAGES` | ~3 pts/min at cap 3 |

Admin `POST /admin/twitch/poll` still runs inline coverage (not fan-out) for debugging.

---

## Daily ops budget (Free tier)

Official limits: [Workers](https://developers.cloudflare.com/workers/platform/limits/) · [D1](https://developers.cloudflare.com/d1/platform/pricing/) · [Queues](https://developers.cloudflare.com/queues/platform/pricing/) · [Queues on Free (Feb 2026)](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)

**Queues on Workers Free (2026-02-04):** 10,000 **operations/day** ([changelog](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)); each write/read/delete counts per **64 KB chunk** of message data ([Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)). Batches bill per message, not per batch. 24h retention. Keep `max_retries=2` on staging (see `wrangler.jsonc` default consumer).

| Resource | Free daily cap | Staging target (`shards_only`, 200 tracked, `*/5` cron) | Production Paid (`full`, `*/1`, `cpu_ms=30000`) |
|----------|----------------|--------------------------------------------------------|--------------------------------------------------|
| Queue ops | 10,000 | ~2,000–3,000 | ~**22k/day** (~7.2k msgs × 3 ops; **~650k/mo** — inside Paid 1M) |
| D1 rows written | 100,000 | &lt;50,000 with 200 live × sparse samples | Rollup + full coverage — monitor `D1_META_LOG` |
| D1 rows read | 5,000,000 | Rankings + health (rollup-first) | Same |
| Worker subrequests / invocation | 50 | Each shard message: 1 Helix + batched D1 (+1 R2 put if archive on) | Sweep message: up to `LIVE_SWEEP_MAX_PAGES` Helix + D1 |
| Worker CPU / invocation | 10 ms | `max_batch_size=5` consumer; shards + sweep cap 3 | `cpu_ms=30000`; `max_batch_size=3` |
| Workers Logs events | **200k/day** (Free) | `head_sampling_rate=1` (staging wrangler) | `head_sampling_rate=0.25` (prod wrangler) — [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) |
| R2 Class A (writes) | 1M / month | 0 (archive off) | Optional: 1 NDJSON object per poll shard / sweep page when `SAMPLE_ARCHIVE_ENABLED=1` |

### Queue ops formula

```
ops_per_message ≈ 3   (write + read + delete/ack)
ops_per_day ≈ messages_delivered × 3 + (retries × reads) + DLQ_writes
```

**Per-message billing:** A consumer batch of 10 still counts as **10 reads** and **10 deletes**, not one ([Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)).

Example (staging):

- Cron every 5 min → 288 `poll_platform`/day
- `shards_only` with 200 tracked → 2 shard messages per tick → 576 `poll_channel_batch` deliveries
- Discover/rollup crons → ~34 extra messages/day
- Total delivered ≈ **900** → **~2,700 queue ops/day** (under 10k; headroom for retries)

Example (production `full`, `*/1`):

- 1,440 cron ticks/day → each `sendBatch` of **2** coverage messages → **2,880** coverage deliveries
- Plus reconcile → enrich messages, daily rollup, discover — budget **Paid** plan (1M ops/month included)

### D1 write formula (rough)

```
writes_per_min ≈ live_streams × (channel upsert + session + sample)
```

With batching + `ON CONFLICT DO NOTHING` on samples, target **&lt;100 writes/min** on Free staging.

---

## Helix budget governor

`HelixRateBudget` tracks Twitch headers. Sweep dynamically caps pages when remaining points are low:

| Remaining pts | Max sweep pages |
|---------------|-----------------|
| ≤5 | 0 (stop) |
| &lt;20 | 1 |
| &lt;60 | 3 |
| &lt;150 | 10 |
| else | `LIVE_SWEEP_MAX_PAGES` |

Set `LIVE_SWEEP_MAX_PAGES=3` on Free even when budget is healthy.

---

## D1 efficiency knobs (implemented)

| Technique | Where |
|-----------|--------|
| `DB.batch()` rollup upserts (≤50 stmt) | `rollup/daily-job.ts` |
| `DB.batch()` offline `last_seen` | `twitch/poll.ts` |
| Remove post-upsert channel SELECT | `db/twitch.ts` |
| Index `viewer_samples(sampled_at)` | migration `0007` |
| D1 meta logs (`rows_read` / `rows_written`) | `db/d1-meta.ts` — per-batch from D1 `meta`; queue summary `d1:poll_cycle` — on when `ENVIRONMENT ≠ production` or `D1_META_LOG=1` (staging wrangler bakes `D1_META_LOG=1`) |

Apply migrations locally:

```bash
bun run d1:migrate:local
```

---

## Public API hardening

| Surface | Production behavior |
|---------|---------------------|
| `GET /v1/*` | 60 req/min/IP (override `INGEST_RATE_LIMIT_PER_MINUTE`) |
| Local / vitest | Bypass when `ENVIRONMENT ≠ production` |
| `GET /health` | Minimal public JSON; `?detailed=1` + admin key for full metrics |

---

## R2 archival

**Shipped (minimal path):** `src/r2/sample-archive.ts` writes **NDJSON** batches to binding `SAMPLES` when `SAMPLE_ARCHIVE_ENABLED=1` **and** `rows.length ≥ SAMPLE_ARCHIVE_MIN_ROWS` (default **10**). Wired from catalog poll (`poll.ts`) and sweep/game-pass pages (`stream-page.ts`). Keys: `samples/year=…/month=…/day=…/platform=twitch/part-{uuid}.ndjson`.

Parquet encode remains **deferred** (no DuckDB in Workers). Production default: archive **off** (`SAMPLE_ARCHIVE_ENABLED=0` in `env.production.vars`). Enable after hot-window prune is stable — see [23-paid-tier — R2 NDJSON archive](./23-paid-tier-zero-overage-playbook.md#r2-ndjson-archive).

Design: [11-cloudflare-deployment — R2 patterns](./11-cloudflare-deployment.md#r2-patterns).

---

## Paid tier — remaining gaps

| Item | Why Paid |
|------|----------|
| Full `INGEST_COVERAGE_MODE=full` fan-out (4+ messages/min) | CPU + subrequests per phase |
| `TWITCH_MAX_TRACKED` 3000+ | D1 writes + queue volume |
| `LIVE_SWEEP_MAX_PAGES` 80 | 80+ Helix subrequests per sweep message |
| Daily rollup on large sample days | CPU &gt;10 ms on Free |
| KV precomputed rankings | Optional cost saver on read path |

Deploy checklist: [11-cloudflare-deployment — Production deploy checklist](./11-cloudflare-deployment.md#production-deploy-checklist).  
After enabling Workers Paid, use [23-paid-tier-zero-overage-playbook](./23-paid-tier-zero-overage-playbook.md) for monthly SKU budgets and production knob targets.
