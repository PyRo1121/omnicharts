# Paid-tier zero-overage playbook (2026)

**Audience:** Operators moving OmniCharts ingest to **Workers Paid** with a hard monthly cap (~$5–25).  
**Related:** [ADR-004](./adr/0004-cloudflare-free-vs-paid.md) · [11-cloudflare-deployment](./11-cloudflare-deployment.md) · [22-ingest-free-tier-tuning](./22-ingest-free-tier-tuning.md) · [cloudflare-free-tier-audit](./audits/cloudflare-free-tier-audit.md) · [ingest-d1-query-audit](./audits/ingest-d1-query-audit.md)

Official pricing (ground truth): [Workers](https://developers.cloudflare.com/workers/platform/pricing/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [D1](https://developers.cloudflare.com/d1/platform/pricing/) · [Queues](https://developers.cloudflare.com/queues/platform/pricing/) · [R2](https://developers.cloudflare.com/r2/pricing/) · [Queues on Free (Feb 2026)](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)

---

## 1. Executive summary

### What **Workers Paid ($5/mo minimum)** buys

Workers Paid is a **$5/month account minimum** on the **Standard** usage model. It is **not** a flat “unlimited ingest” plan. Each product (Workers compute, D1, Queues, R2, KV, …) has **separate included monthly quotas**; overages bill independently.

| Included on Workers Paid (monthly, account-level unless noted) | Typical OmniCharts use |
|------------------------------------------------------------------|------------------------|
| **10M Worker requests** + **30M CPU-ms** | Ingest cron + queue consumer + Pages Functions ([pricing](https://developers.cloudflare.com/workers/platform/pricing/)) |
| **1M Queue operations** | Twitch `full` coalesced coverage (~130k ops/mo at `*/1` — see calculator below) |
| **25B D1 rows read** | Rollup-first UI + health (low if indexed) |
| **50M D1 rows written** | **Primary budget risk** at minute-level samples |
| **5 GB D1 storage** (then $0.75/GB-mo) | Hot `viewer_samples` 14d + rollups |
| **R2:** 10 GB-mo + 1M Class A + 10M Class B (account-level) | Off by default (`SAMPLE_ARCHIVE_ENABLED=0`) |
| **KV** (optional rankings cache) | 10M reads + 1M writes/mo if enabled |
| **No egress/throughput charges** for Workers/R2/D1 | Matches ADR-004 serverless choice |

**Subrequests:** Inbound Worker requests are billed; **outbound subrequests (Helix `fetch`, D1, R2) are not billed as Worker requests** ([Workers pricing footnote 1](https://developers.cloudflare.com/workers/platform/pricing/)). They still count toward **per-invocation subrequest limits** (10,000 on Paid — [limits](https://developers.cloudflare.com/workers/platform/limits/)).

**CPU time:** Billable **CPU milliseconds** (actual CPU, not wall time waiting on `fetch`/D1). Paid default **30s** per invocation (configurable to 5 min). Cron/queue consumers may use up to **15 min wall time** ([limits](https://developers.cloudflare.com/workers/platform/limits/)).

### What a **~$20/month** line item usually is

| Product | ~Price | Bundles Workers ingest? |
|---------|--------|-------------------------|
| **[Cloudflare Pro](https://www.cloudflare.com/plans/)** (zone plan) | **$20/mo** per zone (annual) or **$25/mo** monthly | **No** — CDN, WAF, DNS, bot fight mode for a **domain**. Pages/Workers still meter separately. |
| **Workers Paid + light overage** | **$5** base + ~$0–15 usage | **Yes** — realistic target for solo beta. |
| **[Workers for Platforms](https://developers.cloudflare.com/workers/platform/pricing/)** | **$25/mo** minimum | Multi-tenant dispatch; **not** required for OmniCharts MVP. |

**Recommendation:** Budget **$5 Workers Paid** for ingest + D1/Queues; add **Pro ($20/zone)** only if you need WAF/cache rules on a custom domain — not for D1 write headroom.

### Zero-surprise policy

1. **Workers Paid is necessary** for production Twitch `INGEST_COVERAGE_MODE=full` + `cpu_ms=30000` ([ADR-004](./adr/0004-cloudflare-free-vs-paid.md)).
2. **Stay inside bundle** by tuning **D1 writes** first, then queue message count, then CPU-ms.
3. **Do not enable R2 NDJSON archive** until hot-window prune is stable and you have modeled Class A puts.
4. **Watch D1 row metrics** in dashboard before any SKU overage ([D1 pricing — track usage](https://developers.cloudflare.com/d1/platform/pricing/)).

---

## 2. Included vs metered (2026)

| SKU | Workers Free | Workers Paid included | Overage (2026 docs) |
|-----|--------------|----------------------|---------------------|
| **Worker requests** | 100k/day | 10M/month | $0.30 / million ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) |
| **Worker CPU time** | 10 ms / invocation | 30M CPU-ms/month | $0.02 / million CPU-ms |
| **Subrequests / invocation** | 50 | 10,000 | Limit, not per-request $ |
| **Queue operations** | **10k/day** ([changelog](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)) | **1M/month** | $0.40 / million ([Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)) |
| **D1 rows read** | 5M/day | 25B/month | $0.001 / million |
| **D1 rows written** | 100k/day | 50M/month | $1.00 / million |
| **D1 storage** | 5 GB total | 5 GB + | $0.75 / GB-mo |
| **R2 storage** | 10 GB-mo (Standard) | Same free tier on Paid account | $0.015 / GB-mo |
| **R2 Class A** (PutObject, List, …) | 1M/month | Same | $4.50 / million |
| **R2 Class B** (GetObject, Head, …) | 10M/month | Same | $0.36 / million |
| **R2 egress to Internet** | Free | Free | — ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)) |
| **Pages Functions** | Shares Workers limits | Billed as Workers | Same table |
| **Pages static asset requests** | — | **Free and unlimited** | — ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) |

**Queues billing detail:** Each message delivery ≈ **3 operations** (write + read + delete). **Per message**, not per batch ([Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)). Retries add reads; DLQ adds writes.

**D1 on Paid:** Upgrading from Free removes **daily** read/write hard stops; **monthly** included caps still apply ([D1 FAQ](https://developers.cloudflare.com/d1/platform/pricing/)).

---

## 3. OmniCharts daily budget calculator

Use these formulas with dashboard `rows_read` / `rows_written` and queue analytics. Illustrative numbers — **measure in staging/prod**.

### Constants (from repo)

| Symbol | Meaning | Default / prod |
|--------|---------|----------------|
| `C` | Cron ticks per day | `*/1` → **1440**; staging `*/5` → **288** |
| `F` | Fan-out messages per `*/1` twitch cron (`full`) | **2** (`sweep`+game pass inline, `reconcile`) — [`platform-coverage.ts`](../workers/ingest/src/platform-coverage.ts) |
| `E` | Extra enrich queue messages | **0** (inline in `poll_twitch_reconcile`) |
| `S` | Catalog shard messages per tick (`shards_only`) | `ceil(TWITCH_MAX_TRACKED / 100)` |
| `P` | Sweep pages per sweep message | `LIVE_SWEEP_MAX_PAGES` (default **80**, prod unset → 80) |
| `L` | Live streams ≥ `TWITCH_MIN_VIEWERS` sampled per minute | **200–800** typical; stress **1500–4000** |
| `W` | D1 rows written per live sample (order of magnitude) | **3–6** (channel + session + sample; indexes add +1) |
| `B_t`, `B_k`, `B_y` | Platform budget shares (D1 + planning) | **0.55 / 0.25 / 0.20** — [`ingest-budget.ts`](../workers/ingest/src/ingest-budget.ts) |
| `F_p` | Queue messages per twitch cron tick | Twitch **1** (coalesced coverage); Kick **1**; YouTube **1** |
| `C_2` | `*/2` cron ticks per day | **720** (Kick + YouTube enqueue only) |

### Shared budget allocator (3-way)

Code: [`workers/ingest/src/ingest-budget.ts`](../workers/ingest/src/ingest-budget.ts) · coverage shapes: [`platform-coverage.ts`](../workers/ingest/src/platform-coverage.ts).

| Pool | Total (planning) | Twitch | Kick | YouTube |
|------|------------------|--------|------|---------|
| D1 writes/day target | **1.2M** (`PAID_D1_WRITES_PER_DAY_TARGET`) | 55% (~660k) | 25% (~300k) | 20% (~240k) |
| Queue fan-out per poll | — | **2** msgs (`sweep` incl. game pass, `reconcile`) | **1** (`poll_kick_tracked`) | **1** (`poll_youtube_tracked`) |
| Helix points/min | **720** | 100% | — (Kick ~60 req/min separate) | — (10k units/day separate) |
| Planned live cap `L` | additive | ≤500 | ≤120 | ≤80 |

**Rule:** Adding Kick/YouTube must **not** run three Twitch-style sweep messages per platform. Cron `*/2` enqueues one `poll_platform` each for Kick and YouTube; consumers fan out to a **single** tracked-batch message type.

```ts
import { estimateIngestQueueBudget } from '../workers/ingest/src/ingest-budget';

estimateIngestQueueBudget({
  twitchCronTicksPerDay: 1440,
  multiPlatformCronTicksPerDay: 720,
  twitchEnrichPerMinute: 1,
});
```

### Queue operations / day

```
messages_per_day ≈ C × (F + E) + C_discover×2 + 1_rollup
queue_ops_per_day ≈ messages_per_day × 3 × (1 + retry_factor)
```

Cron enqueues coverage messages directly (no `poll_platform` hop). Profile enrich runs on the **6h discover cron** (`poll_twitch_enrich`), not per-minute reconcile.

**Production Twitch `full`, `*/1` (lane-3 defaults):**

| Term | Count/day |
|------|-----------|
| Coalesced coverage (`F=1`) | 1,440 |
| Discover + enrich + EventSub + Kick (`0 */6`, ×4/day) | 16 |
| Rollup | 1 |
| **Messages** | **~1,457** |
| **Queue ops** (`×3`) | **~4.4k** |
| **Queue ops / month** | **~130k** → **inside 1M included** |

**Legacy two-message fan-out (pre–P1 coalesce):** 2,880 msgs/day → ~260k queue ops/mo — still under 1M, but more Worker wakeups.

**Legacy `shards_only` at `TWITCH_MAX_TRACKED=3000` (per-shard messages, pre–lane-3):**

| Term | Count/day |
|------|-----------|
| Platform + shards | 1,440 × (1 + 30) = **45,120** |
| **Queue ops / month** | **~4.0M** → **~$1.20** overage at $0.40/M (above 1M bundle) |

**Current code:** `shards_only` with `TWITCH_MAX_TRACKED ≤ 500` → **1** `poll_twitch_catalog` message/tick; above 500 → auto **full** fan-out (2 msgs). Prefer **`INGEST_COVERAGE_MODE=full`** in production.

### D1 rows written / day

```
writes_per_day ≈ minutes_per_day × L × W
             ≈ 1440 × L × W
```

| Live `L` | `W=4` writes/min | Writes/day | vs Paid 50M/mo (~1.67M/day) |
|----------|------------------|------------|------------------------------|
| 200 | 800/min | **1.15M** | Over — tune down |
| 120 | 480/min | **691k** | Under |
| 500 | 2000/min | **2.88M** | Large overage ($$) |

**Paid D1 write overage:** `(writes_month − 50M) × $1.00 / 1M`. Example: **80M writes/mo** → **~$30** D1 line item alone.

**Mitigations (in order):** lower effective `L` via `TWITCH_MIN_VIEWERS`; cap sweep pages; batch sample `INSERT`; prune at 14d; avoid duplicate sweep+shard paths.

### D1 rows read / day

Rollup-first rankings: **low** (thousands–millions/day). Risk: unindexed `viewer_samples` scans — mitigated by `0007`/`0008` ([ingest-d1-query-audit](./audits/ingest-d1-query-audit.md)). **25B/mo** included is not the binding constraint for MVP.

### Worker requests / month

```
requests_month ≈ (ingest_cron + ingest_queue + pages_ssr + public_api) × 30
```

Ingest-only rough (1 cron + ~1 consumer/msg, `F=1`): **(1440 + 1440) × 30 ≈ 86k/mo** worker invocations — well under **10M**. Queue ops ~**130k/mo** (see calculator). Pages traffic dominates at scale; static assets on Pages are **free** ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).

### CPU-ms / month

```
cpu_ms_month ≈ invocations_month × avg_cpu_ms_per_invocation
```

Queue consumer doing sweep + D1: plan **50–500 ms CPU** per message under load. Example: **7k invocations/day × 100 ms × 30 ≈ 21M CPU-ms/mo** — near **30M included**. **Knob:** `limits.cpu_ms` caps runaway; optimize sweep pages and D1 batching.

### R2 Class A puts / month (`SAMPLE_ARCHIVE_ENABLED=1`)

```
eligible_puts_day ≈ archive_calls_per_day × P(rows ≥ SAMPLE_ARCHIVE_MIN_ROWS)
puts_month ≈ eligible_puts_day × 30
```

One NDJSON `PutObject` (Class A) per poll shard batch and/or per sweep page **only when** `SAMPLE_ARCHIVE_ENABLED=1` **and** `rows.length ≥ SAMPLE_ARCHIVE_MIN_ROWS` (default **10**) — [`sample-archive.ts`](../workers/ingest/src/r2/sample-archive.ts). Small batches skip the put to conserve Class A ops.

| Mode | Approx puts/day | puts/mo | vs 1M Class A free |
|------|-----------------|---------|---------------------|
| Archive **off** (`SAMPLE_ARCHIVE_ENABLED=0`, prod default) | **0** | **0** | — |
| On, no row gate (hypothetical `MIN_ROWS=1`) | ~5k | ~150k | Inside free tier |
| On, `MIN_ROWS=10` (~30% batches skipped) | ~3.5k | ~105k | Inside free tier |

**Storage** grows with retained NDJSON (~200–500 B/row). Keep archive off until 14d hot-window prune is proven ([§4](#4-knobs-to-stay-in-bundle)).

### Multi-platform (Kick + YouTube) — shared allocator

Roadmap Phase 3 ([ROADMAP](../ROADMAP.md), [05-ingestion](./05-ingestion-per-platform.md), [ADR-003](./adr/0003-kick-ingest-strategy.md)):

| Platform | Catalog cap (doc) | Cron | Queue per tick | D1 share |
|----------|-------------------|------|----------------|----------|
| Twitch | 1.5k–3k | `*/1` | `F_t=1` coalesced coverage; enrich on discover cron | `B_t=0.55` |
| Kick | 300–800 | `*/2` | 1 → `poll_kick_tracked` only | `B_k=0.25` |
| YouTube | 150–350 live | `*/2` | 1 → `poll_youtube_tracked` only | `B_y=0.20` |

```
messages_per_day ≈ C×(F_t + E) + C_2×(F_k + F_y) + discover + rollup
L_total ≈ L_twitch + L_kick + L_youtube   (each L capped by allocator + doc 05)
writes_per_day ≈ 1440 × W × L_total
```

**Queue:** Three-platform plan adds **~1,440 messages/day** (720 kick + 720 youtube), not 3× Twitch fan-out — stays **&lt; 1M queue ops/mo** with `*/2` cron ([`estimateIngestQueueBudget`](../workers/ingest/src/ingest-budget.ts)).

**D1:** Writes scale with **live streams sampled** per platform share; do not enable `*/2` in `wrangler.jsonc` until Twitch-only dashboard is green **14 days** (§6).

**YouTube:** `YOUTUBE_API_UNITS_PER_DAY=10000` in allocator — separate from Cloudflare; may bind before D1 ([05-ingestion — quota math](./05-ingestion-per-platform.md)).

---

## R2 NDJSON archive

Ground truth: [R2 pricing (2026)](https://developers.cloudflare.com/r2/pricing/) — free tier is **account-level**, same on Workers Free and Paid.

| R2 metric | Free tier / month | Overage (Standard) | OmniCharts use |
|-----------|-------------------|--------------------|----------------|
| **Storage** | 10 GB-month | $0.015 / GB-month | NDJSON parts under `samples/year=…/` |
| **Class A** (PutObject, ListObjects, …) | **1M requests** | $4.50 / million | **1 put per archived batch** — primary cost when enabled |
| **Class B** (GetObject, HeadObject, …) | **10M requests** | $0.36 / million | Phase 4 replay / analytics only |
| **Egress** | Free | Free | No public bucket |
| **DeleteObject** | Free | Free | Lifecycle / prune jobs |

**Class A vs B:** Ingest writes use **Class A** only (`PutObject`). Reads during cold replay or DuckDB offline jobs use **Class B**. `DeleteObject` is free.

### Smart gate (shipped)

Two layers — both must pass before `SAMPLES.put`:

| Gate | Env | Production default | Effect |
|------|-----|-------------------|--------|
| Master switch | `SAMPLE_ARCHIVE_ENABLED` | **`0`** ([`wrangler.jsonc`](../workers/ingest/wrangler.jsonc)) | **Zero puts** — binding stays wired, code path no-ops |
| Row threshold | `SAMPLE_ARCHIVE_MIN_ROWS` | **`10`** | Skip put when batch smaller (typical sparse sweep page) |

Wiring: catalog poll shard ([`poll.ts`](../workers/ingest/src/twitch/poll.ts)), sweep/game-pass pages ([`stream-page.ts`](../workers/ingest/src/twitch/stream-page.ts)) → `archiveSampleBatch`. Keys: `samples/year=YYYY/month=MM/day=DD/platform=twitch/part-{uuid}.ndjson`.

### When to enable

1. Hot `viewer_samples` 14d prune stable for **14 days** ([06-storage](./06-storage-and-rollup-design.md)).
2. Dashboard R2 Class A **= 0** with archive off (misconfig check).
3. Model puts with §3 calculator; target **&lt; 200k Class A/mo** for headroom.
4. Set `SAMPLE_ARCHIVE_ENABLED=1` in staging first; watch storage GB-month.
5. Production: enable only if cold retention required before Phase 4 Parquet pipeline.

Parquet encode remains **deferred** (no DuckDB in Workers). Do not lower `SAMPLE_ARCHIVE_MIN_ROWS` below 5 without remeasuring put rate.

---

## 4. Knobs to stay in bundle

| Knob | Env / config | Stay-in-bundle effect |
|------|--------------|------------------------|
| **`INGEST_COVERAGE_MODE`** | `full` (prod) vs `shards_only` / `sweep_only` | `full` = 2 queue msgs/min; `shards_only` at 3k IDs = **30 msgs/min** (queue risk) |
| **`TWITCH_MAX_TRACKED`** | Default **3000** in root `wrangler.jsonc`; staging **200** | Caps catalog shards only; does not cap sweep discovery |
| **`LIVE_SWEEP_MAX_PAGES`** | Prod wrangler **40**; Free/staging **3**; code default **80** if unset | Linear Helix + D1 + subrequests per sweep message |
| **`TWITCH_MIN_VIEWERS`** | Prod **20** | Lowers `L` (live streams written) — largest D1 lever |
| **Cron** | Prod `*/1`; staging `*/5` | Linear on all per-minute costs |
| **Sample retention** | 14d hot + prune ([06-storage](./06-storage-and-rollup-design.md)) | Storage + rollup read cost |
| **`SAMPLE_ARCHIVE_ENABLED`** | **0** in prod ([`wrangler.jsonc`](../workers/ingest/wrangler.jsonc)) | Avoids R2 Class A + storage growth |
| **`SAMPLE_ARCHIVE_MIN_ROWS`** | **10** (default) | When archive on: skip Class A put for sparse batches |
| **`COLD_ARCHIVE_ENABLED`** | **0** in prod ([`wrangler.jsonc`](../workers/ingest/wrangler.jsonc)) | Parquet cold path off until hot prune stable; cap batches per rollup run when enabled |
| **`limits.cpu_ms`** | **30000** prod | Prevents runaway CPU-ms billing |
| **Queue `max_retries`** | staging **2**, prod **3** | Retries multiply queue ops |
| **Queue `max_batch_size`** | staging **5**, prod **3** | Prod headroom for discover batch + retries ([`wrangler.jsonc`](../workers/ingest/wrangler.jsonc)) |
| **Pages SSR** | Direct D1 for rollups (shipped) | Cuts Worker requests vs ingest proxy |
| **Pages `TWITCH_*` vars** | `apps/web/wrangler.jsonc` `env.production.vars` | Same ranking eligibility as ingest prod (`20` / `60`) |
| **`D1_META_LOG=1`** | Staging | Audit `meta.rows_*` before prod scale |
| **`observability.logs.head_sampling_rate`** | staging **1**, prod ingest/Pages **0.25** | Paid **10M** log events/mo included ([Workers Logs pricing](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#pricing)); 25% on `*/1` cron + queue consumers keeps headroom |

**Baked defaults (no operator env flags):** All caps below live in [`workers/ingest/wrangler.jsonc`](../workers/ingest/wrangler.jsonc) `env.production` / `env.staging` `vars` (secrets stay in `wrangler secret put` only).

| Knob | Staging (`--env staging`, Workers Free) | Production (`--env production`, Workers Paid) | Budget note |
|------|----------------------------------------|-----------------------------------------------|-------------|
| **Cron** | `*/5` | `*/1` | Staging ~288 platform ticks/day; prod **1,440** |
| **`INGEST_COVERAGE_MODE`** | `shards_only` | `full` | Prod coalesced coverage **~130k queue ops/mo** (&lt; 1M included) |
| **`limits.cpu_ms`** | *(unset — Free 10 ms cap)* | `30000` | Paid default per [limits](https://developers.cloudflare.com/workers/platform/limits/) |
| **`TWITCH_MAX_TRACKED`** | `200` | `3000` | Shards only; prod catalog cap |
| **`LIVE_SWEEP_MAX_PAGES`** | `3` | `40` | Prod below code default **80** — Helix/CPU headroom; governor still throttles |
| **`TWITCH_MIN_VIEWERS`** | `20` | `20` | Primary **D1 write** lever (`L` live streams) |
| **`TWITCH_RANKING_MIN_AIRTIME_MINUTES`** | `60` | `60` | Rankings gate (ingest + Pages) |
| **`SAMPLE_ARCHIVE_ENABLED`** | `0` | `0` | R2 Class A off until prune proven |
| **`COLD_ARCHIVE_ENABLED`** | `0` | `0` | Parquet archive off; enable only after 14d hot prune + Class A model |
| **Queue consumer** | root: `max_batch_size=5`, `max_batch_timeout=5`, `max_retries=2` | `max_batch_size=3`, `max_batch_timeout=5`, `max_retries=3` | One consumer invocation drains full fan-out (3 msgs/tick); queue **ops** per message unchanged |
| **Observability logs** | `head_sampling_rate=1` | ingest + Pages: `head_sampling_rate=0.25` | Explicit sampling in wrangler; raise to `1` briefly when debugging prod |

**Modeled prod month (Twitch-only, table above):** queue ops **~130k**, D1 writes **~35M** at moderate `L` — inside Paid **1M** / **50M** bundles ([§8](#8-example-monthly-bill-twitch-only-beta-target)). Tune `TWITCH_MIN_VIEWERS` or `LIVE_SWEEP_MAX_PAGES` only after dashboard evidence — not via manual `.dev.vars` on deploy.

**Helix governor:** Dynamic sweep cap when rate-limit budget low ([22-ingest-free-tier-tuning](./22-ingest-free-tier-tuning.md)).

---

## 5. Alerts and dashboards

Watch **before** overage emails:

| Dashboard | Metric | Action threshold (indicative) |
|-----------|--------|------------------------------|
| **D1 → omnicharts → Row metrics** | Rows written / day | **&gt; 1.2M/day** sustained → reduce `L` or raise `TWITCH_MIN_VIEWERS` |
| **D1** | Rows read / query | Spike on `viewer_samples` → index / query audit |
| **Workers & Pages → ingest** | CPU time, errors 1102 | CPU p95 → lower sweep pages or batch D1 |
| **Queues → omnicharts-ingest** | Operations / day | **&gt; 30k/day** → check retries, shard fan-out |
| **Workers requests** | Daily invocations | Unusual growth → SSR abuse or missing CDN cache |
| **R2** | Class A ops, storage | Nonzero with `SAMPLE_ARCHIVE_ENABLED=0` → misconfig; spike with archive on → lower `MIN_ROWS` or keep off |
| **Account billing** | Workers Paid + D1 + Queues line items | Any non-$0 overage SKU |

Enable **`D1_META_LOG=1`** in staging and sample `logD1Meta` output ([`d1-meta.ts`](../workers/ingest/src/db/d1-meta.ts)).

---

## 6. Phased rollout

| Phase | Environment | Plan | Profile | Gate |
|-------|-------------|------|---------|------|
| **0** | Local | SQLite / Miniflare | Any | `bun run verify:twitch` |
| **1** | CF staging | Workers **Free** | `shards_only`, `TWITCH_MAX_TRACKED=200`, `*/5`, `LIVE_SWEEP_MAX_PAGES=3` | Queue ops &lt; 10k/day |
| **2** | CF prod | Workers **Paid** | Twitch-only `full`, `cpu_ms=30000`, archive **off** | 7d dashboard: D1 writes &lt; 1.5M/day |
| **3** | CF prod | Paid | Tune `LIVE_SWEEP_MAX_PAGES` / `TWITCH_MIN_VIEWERS` from metrics | Rankings fresh, no D1 overage |
| **4** | CF prod | Paid | Enable Kick **or** YouTube (one cron path) | Re-run queue + D1 calculator |
| **5** | CF prod | Paid + optional **Pro zone** | Custom domain + WAF | Pro is CDN/WAF, not ingest |

**Do not** enable Kick/YouTube minute crons until Twitch-only budget is green for **14 days**.

---

## 7. Gaps in current code and docs

| Gap | Impact | Mitigation |
|-----|--------|------------|
| **Per-stream D1 writes** not batched | Dominates write budget at high `L` | Future multi-row sample insert ([ingest-d1-query-audit](./audits/ingest-d1-query-audit.md)) |
| **`LIVE_SWEEP_MAX_PAGES` tuning** | Baked **40** in prod wrangler | Raise toward **80** only if D1 writes &lt; 1M/day and rankings stale |
| **Game rankings `EXISTS` query** | Extra D1 reads | **Done** — `INNER JOIN` eligible games ([lane final pass](./audits/cloudflare-hardening-complete.md)) |
| **KV precomputed rankings** | Doc-only | Optional read savings |
| **Parquet R2 pipeline** | Phase 4; NDJSON stub only | Keep `SAMPLE_ARCHIVE_ENABLED=0` |
| **Runbook `*/2` Kick/YouTube cron** | Scaffolded in `cron-messages.ts`; not in `wrangler.jsonc` yet | Add `"*/2 * * * *"` after 14d green Twitch-only metrics |
| **Kick/YouTube poll handlers** | Stubs in `kick/`, `youtube/` | Implement after freeze gate M5 |
| **No automated CF budget alerts in repo** | Manual dashboard | Wire billing notifications in CF account |
| **YouTube quota** | Non-CF hard cap | Separate from this playbook |

---

## 8. Example monthly bill (Twitch-only beta target)

**Goal:** **$5–8/mo** total Cloudflare Workers SKUs (no Pro zone).

| SKU | Modeled usage | vs included | Est. charge |
|-----|---------------|-------------|-------------|
| Workers subscription | — | — | **$5.00** |
| Requests | 500k/mo | &lt; 10M | $0 |
| CPU-ms | 15M/mo | &lt; 30M | $0 |
| Queue ops | 130k/mo | &lt; 1M | $0 |
| D1 writes | 35M/mo | &lt; 50M | $0 |
| D1 reads | 500M/mo | &lt; 25B | $0 |
| R2 | Archive off | Free tier | $0 |
| **Total** | | | **~$5** |

If **D1 writes hit 80M/mo**, add **~$30** D1 overage — fix with knobs in §4, not by buying Pro.

---

## Verified 2026 quota snapshot (official)

**Verified:** 2026-06-03 against Cloudflare developer docs (Workers Paid = **$5/mo** account minimum on **Standard** usage model). Bundled quotas are **not interchangeable** across SKUs.

| SKU | Workers Free | Workers Paid included | Overage |
|-----|--------------|----------------------|---------|
| **Worker requests** | 100k/day | **10M/mo** | $0.30/M ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) |
| **Worker CPU time** | 10 ms/invocation | **30M CPU-ms/mo**; default **30s**/invocation, max **5 min** (300,000 ms) | $0.02/M CPU-ms |
| **Cron / queue consumer CPU (wall)** | 10 ms CPU cap | **15 min** wall/invocation; consumer CPU configurable via `limits.cpu_ms` | — ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)) |
| **Subrequests / invocation** | 50 | **10,000** (up to 10M configurable) | Limit, not $/request |
| **Queue operations** | **10k/day** ([Feb 2026](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)) | **1M/mo** | $0.40/M ([Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)) |
| **Queue retention** | 24h (fixed) | 4 days default, up to **14 days** | — |
| **D1 rows read** | 5M/day | **25B/mo** | $0.001/M ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)) |
| **D1 rows written** | 100k/day | **50M/mo** | $1.00/M |
| **D1 storage** | 5 GB (account total) | **5 GB** included + $0.75/GB-mo | — |
| **D1 max DB size** | 500 MB/DB | **10 GB**/DB | — ([D1 limits](https://developers.cloudflare.com/d1/platform/limits/)) |
| **D1 queries / Worker invocation** | 50 | **1,000** | Hard limit |
| **Workers KV reads** | 100k/day | **10M/mo** | $0.50/M |
| **Workers KV writes** | 1k/day | **1M/mo** | $5.00/M |
| **Workers KV storage** | 1 GB | **1 GB** + $0.50/GB-mo | — |
| **R2 (Standard)** | **10 GB-mo** + **1M** Class A + **10M** Class B | Same account-level free tier on Paid | Storage $0.015/GB-mo; Class A $4.50/M; Class B $0.36/M ([R2](https://developers.cloudflare.com/r2/pricing/)) |
| **Pages Functions** | Workers Free limits | Same as Workers Paid table | Billed as Workers |
| **Pages static assets** | Free, unlimited requests | Free, unlimited | — ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) |

**CPU billing nuance:** CPU-ms is **active CPU only** — time blocked on `fetch`, D1, KV, or R2 I/O does not count ([Workers limits — CPU time](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)).

**OmniCharts binding constraints (typical ingest message &lt; 64 KB):** use §3 formulas; oversized queue bodies would multiply queue ops.

---

## Community patterns (wrangler production tuning)

Patterns observed in public `wrangler.jsonc` / Cloudflare docs — not OmniCharts requirements. Use when tuning Paid ingest or Pages SSR.

| Pattern | Rationale | Example / source |
|---------|-----------|------------------|
| **`wrangler.jsonc` over TOML** | Newer limits (`cpu_ms`, `subrequests`) are JSON-first | [cloudflare-docs — Wrangler configuration](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/wrangler/configuration.mdx) |
| **`env.staging` / `env.production`** | Separate cron, queue consumer, and vars without duplicate Workers | [cloudflare/skills — wrangler SKILL](https://github.com/cloudflare/skills/blob/main/skills/wrangler/SKILL.md) |
| **`limits.cpu_ms` on queue consumers** | Default 30s; raise toward **300000** (5 min) only when sweep/rollup needs it | [cloudflare-docs — Queues limits](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/queues/platform/limits.mdx) |
| **Leave `max_concurrency` unset** | Lets Queues autoscale consumers (up to **250**); pin only to protect upstream APIs | [Consumer concurrency](https://developers.cloudflare.com/queues/configuration/consumer-concurrency/) |
| **`max_batch_size` + `max_batch_timeout` matched to upstream rate** | Batch size aligned with external API limits (e.g. 2 msgs / 10s for 2 req/s) | [Queues rate-limit tutorial](https://developers.cloudflare.com/queues/tutorials/handle-rate-limits/) |
| **`max_batch_timeout: 0` when low latency matters** | Wrangler/deploy accepts zero wait (workers-sdk fix) | [workers-sdk#5859](https://github.com/cloudflare/workers-sdk/commit/f2ceb3a5b993fa56782a6fdf39cd73dbe5c30c83) |
| **DLQ + `max_retries` tuned together** | Retries multiply queue **read** ops; DLQ adds **write** ops | [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| **High-traffic SSR: moderate `cpu_ms` + observability sampling** | Production SSR sets explicit CPU ceiling; sample traces on prod | [modrinth/code — `apps/frontend/wrangler.jsonc`](https://github.com/modrinth/code/blob/d2abeb43/apps/frontend/wrangler.jsonc) |
| **KV for precomputed hot keys** | Optional read-path cache; Paid **10M reads/mo** included | [Workers pricing — KV](https://developers.cloudflare.com/workers/platform/pricing/) |
| **`wrangler types` in CI** | Generated `Env` matches bindings after config edits | [Workers best practices (Feb 2026)](https://developers.cloudflare.com/changelog/post/2026-02-15-workers-best-practices/) |

**OmniCharts defaults (already in repo):** ingest production `cpu_ms=30000`, `max_batch_size=3`, `max_retries=3`, `observability.logs.head_sampling_rate=0.25`, archive off; staging `shards_only`, full log sampling (`1`); Pages production matches **0.25** — see §4, [`workers/ingest/wrangler.jsonc`](../workers/ingest/wrangler.jsonc), [`apps/web/wrangler.jsonc`](../apps/web/wrangler.jsonc).

---

## 9. Queue fan-out defaults (lane 3)

**Grounding (2026):** [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) — Workers Paid **1M operations/month** included; **~3 operations per delivered message** (write + read + delete); operations are **per message**, not per batch.

| Path | Module | Behavior |
|------|--------|----------|
| Cron `*/1` | [`cron-messages.ts`](../workers/ingest/src/cron-messages.ts) → [`twitchCronEnqueueMessages`](../workers/ingest/src/ingest-budget.ts) | `full` → 2 messages; no `poll_platform` hop |
| Coalesced coverage | [`platform-coverage.ts`](../workers/ingest/src/platform-coverage.ts) | `poll_twitch_coverage` (sweep + game pass + reconcile); enrich on discover cron |
| Catalog / staging | [`poll.ts`](../workers/ingest/src/twitch/poll.ts) `poll_twitch_catalog` | One queue message; Helix batches of 100 in one consumer |
| `shards_only` misconfig | `ingest-budget.ts` | `TWITCH_MAX_TRACKED > 500` → same 2-message full fan-out (avoids 30+ shard messages/tick) |
| Reconcile enrich | [`index.ts`](../workers/ingest/src/index.ts) | Inline in `poll_twitch_reconcile` — no chained `poll_twitch_enrich` by default |
| Calculator | `estimateIngestQueueBudget`, `messagesPerTwitchCronTick` | Tests in [`ingest-budget.spec.ts`](../workers/ingest/test/ingest-budget.spec.ts) |

**Consumer tuning:** Production `max_batch_size: 3` aligns with one minute’s twitch fan-out so a single consumer invocation can drain the tick without extra wakeups (Worker **requests** ↓; queue **ops** unchanged).

---

## Related

- [15-ingest-runbook](./15-ingest-runbook.md) — deploy and secrets  
- [21-twitch-ingest-libraries](./21-twitch-ingest-libraries.md) — Helix budget  
- [12-channel-discovery](./12-channel-discovery-and-tracking.md) — tracking caps
