# Ingest D1 query audit — lane 3/5

**Date:** 2026-06-03  
**Scope:** `workers/ingest/src/db/**`, `rollup/**`, `session-lifecycle.ts`, `migrations/d1/**`, `d1-meta.ts`, all `.prepare()` in ingest Worker.  
**References:** [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) (5M rows read / 100k rows written per day Free; billed per `meta.rows_read` / `meta.rows_written`), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) (100 bind params/query; Free Worker ~50 subrequests/invoke), [D1 `batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), [06-storage-and-rollup-design](../06-storage-and-rollup-design.md), [cloudflare-free-tier-audit](./cloudflare-free-tier-audit.md).

---

## D1 billing rules (applied)

| Rule | Implication |
|------|-------------|
| Rows read = rows scanned, not rows returned | Unindexed filters on `viewer_samples` scale with table size |
| Rows written = INSERT/UPDATE/DELETE rows touched | Indexed columns add +1 write per index maintained |
| `DB.batch()` chunk size **50** (`D1_BATCH_MAX_STATEMENTS`) | Aligns with Free Worker subrequest cap; shared in `db/d1-batch.ts` |
| Multi-row INSERT | ≤ `floor(100 / cols)` rows per statement (`D1_MAX_BIND_PARAMS`) |
| Use `result.meta` / `logD1Meta` | Hot paths log when `D1_META_LOG=1` or non-production |

---

## Hot paths — before / after estimates

Illustrative orders of magnitude for **~500 tracked channels**, **~2k live streams/min** (full coverage), **~14d** hot `viewer_samples` (~600k rows). Actual `meta` from staging/prod is authoritative.

| Hot path | Statements (before → after) | Rows read (before → after) | Rows written (before → after) | Notes |
|----------|----------------------------|----------------------------|-------------------------------|-------|
| **Daily rollup — fetch day samples** | 1 → 1 | ~600k (full scan `date()`) → ~40k (index range on `sampled_at`) | 0 | `0007` + `sampled_at >= ? AND < ?` |
| **Daily rollup — channel/game upserts** | N → ⌈N/50⌉ batches | ~N → ~N | N → N | `D1_BATCH_MAX_STATEMENTS` in `daily-job.ts` |
| **Daily rollup — follower snapshot store** | N → ⌈N/50⌉ | ~N → ~N | N → N | `storeFollowerSnapshots` → `runD1Batches` |
| **Poll shard — offline `last_seen`** | ⌈U/50⌉ | ~U | U | `runD1Batches` |
| **Poll/live ingest — `recordLiveSample`** | 3–4 / stream → **~5–8 / 100 streams** | ~3–8 / stream → bulk `IN` + batched sessions | 2–3 / stream (unchanged) | `batchRecordLiveSamples` + multi-row `viewer_samples` |
| **Poll/live — stream id rotation close** | N parallel `.run()` → ⌈N/50⌉ `batch()` | ~open rows / channel → same | same | `batchCloseStaleOpenSessionsForChannels` |
| **Poll/live — `upsertChannelFromStream`** | 2–5 / stream → **~3–6 / 100 streams** | 2–6 / stream → 1–2 `IN` prefetch + `batch()` upserts | 1–2 / stream (unchanged) | `batchUpsertChannelsFromStreams` |
| **Poll/live — `upsertGameCategory`** | 1 / game → **⌈G/20⌉** multi-row INSERT | ~1 / game | ~1 / game | `batchUpsertGameCategories` (20 rows × 5 binds) |
| **Discovery / game-pass page** | N×(channel+sample) → 1× batch page | Same reduction as poll | Same | `ingestHelixStreamsBatch` in `stream-page.ts` |
| **Profile enrichment — UPDATE** | N → ⌈N/50⌉ | ~N | N | `batchApplyChannelProfileEnrichment` → `runD1Batches` |
| **Prune samples** | ⌈D/500⌉ loops | ~500/loop (indexed) | D | `0007` on `sampled_at` |
| **Health lag `MAX(sampled_at)`** | 1 | ~600k → ~1 (platform filter + index) | 0 | Join + index |
| **Rankings read (rollup)** | 1 | ~7×channels rollups | 0 | Uses `idx_channel_rollups_date_hw` |
| **Game rankings eligibility** | 1 | High (nested EXISTS) → JOIN subquery | 0 | **Done** — lane final pass |

**Free-tier write budget (100k/day):** minute ingest still dominates row writes; lane 3 cuts **subrequests** on stale-session closes and aligns all write loops on `runD1Batches` / `D1_BATCH_MAX_STATEMENTS`. Production ingest still requires Paid per ADR-004.

---

## Query audit checklist

| Area | Issue | Fix | Migration |
|------|-------|-----|-----------|
| `fetchSamplesForDate` | `date(sampled_at)` prevents index use | UTC half-open range | — (uses `0007`) |
| `listPlatformIdsForRollupDate` | Same | Range bind | — |
| `storeFollowerSnapshots` | N+1 INSERT loop | `runD1Batches` ×50 | — |
| `batchApplyChannelProfileEnrichment` | N+1 UPDATE loop | `runD1Batches` ×50 | — |
| `recordLiveSample` / poll page | Per-stream round-trips | `batchRecordLiveSamples` + multi-row INSERT | — |
| `upsertChannelFromStream` / poll page | Per-stream SELECT+UPSERT | `batchUpsertChannelsFromStreams` + `IN` prefetch | — |
| `upsertGameCategory` on hot paths | Per-game statement | `batchUpsertGameCategories` multi-row | — |
| Stream id rotation close | N parallel `.run()` on hot page | `batchCloseStaleOpenSessionsForChannels` | — |
| `recordLiveSample` open session | Table scan on `channel_id` | Partial index open sessions | `0008` |
| `listChannelIdsToPoll` / recent tracked | Filter + sort on channels | Composite index | `0008` |
| `viewer_samples` prune / lag | No `sampled_at` index | Index | `0007` |
| Rollup upserts | Loop | `DB.batch()` via `D1_BATCH_MAX_STATEMENTS` | — |
| Offline poll UPDATE | Per-row | `runD1Batches` | — |
| Poll/reconcile offline session close | Missing close on offline | `closeOpenSessionsForPlatformChannelIds` | — |

**Not changed (documented):** reconcile still uses batched `ingestHelixStreamsBatch` only (low volume).

---

## Implementation (lane 3)

| Module | Role |
|--------|------|
| `workers/ingest/src/db/d1-batch.ts` | `D1_BATCH_MAX_STATEMENTS`, `runD1Batches`, `maxRowsPerInsert`, `chunkArray` |
| `workers/ingest/src/db/session-lifecycle.ts` | Offline bulk close; `batchCloseStaleOpenSessionsForChannels` for Helix stream id rotation |
| `workers/ingest/src/db/twitch-live-batch.ts` | Poll/page batch ingest; stale closes before session insert batch |
| `workers/ingest/src/db/follower-snapshots.ts` | Batched `IN` reads; `runD1Batches` for EOD metadata writes |
| `workers/ingest/src/db/twitch.ts` | List queries; `batchApplyChannelProfileEnrichment` |
| `workers/ingest/src/rollup/daily-job.ts` | Index-range sample fetch; batched channel/game rollup upserts |

Single-stream exports (`upsertChannelFromStream`, `recordLiveSample`, `upsertGameCategory`, `closeStaleOpenSessionsForChannel`) delegate to batch helpers for one code path.

---

## Migrations (lane 3 indexes)

| File | Purpose |
|------|---------|
| `0007_viewer_samples_sampled_at_index.sql` | Prune, lag, rollup sample scans |
| `0008_ingest_hot_path_indexes.sql` | `channels(platform_id, ingest_state, last_seen_at)`; partial open `stream_sessions` |

Apply: `bun run d1:migrate:local` (from repo root).

---

## Verification

```bash
bun run d1:migrate:local
bun run test:ingest
```

Focused: `session-lifecycle.spec.ts`, `follower-snapshots.spec.ts`, `rollup-daily-job.spec.ts`, `twitch-live-batch.spec.ts`, `db-twitch-lists.spec.ts`, `prune-samples.spec.ts`, `channel-state.spec.ts`.

Enable meta logs: `D1_META_LOG=1` on ingest Worker (see `workers/ingest/src/db/d1-meta.ts`).

---

## Remediation status

| Item | Status |
|------|--------|
| Index `viewer_samples(sampled_at)` | **Done** — `0007` |
| Index-friendly rollup sample SELECT | **Done** — range + `utcDayEndExclusiveIso` |
| Batch follower snapshot writes | **Done** — `storeFollowerSnapshots` + `runD1Batches` |
| Batch profile enrichment UPDATEs | **Done** — `batchApplyChannelProfileEnrichment` |
| Poll / rollup batch upserts | **Done** |
| Hot path channel + session indexes | **Done** — `0008` |
| Per-stream ingest batching (poll / page) | **Done** — lane 2 |
| Batched stale session close on stream rotation | **Done** — lane 3 |
| Poll/reconcile offline session close | **Done** — `session-lifecycle.ts` |
| Game rankings EXISTS simplification | **Done** — lane final pass 2026-06-03 |
