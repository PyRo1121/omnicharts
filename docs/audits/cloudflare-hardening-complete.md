# Cloudflare hardening — completion checklist

**Date:** 2026-06-03  
**Clean audit (pass 2):** 2026-06-03 — no new P0/P1/P2 in scope after session-lifecycle fix + full verify  
**Scope:** Ingest Worker + Pages web + D1 migrations (Twitch-only production path).  
**Out of scope:** `packages/*`, Kick/YouTube ingest implementation, KV cache.

## Verified in repo

| Check | Status |
|-------|--------|
| Cron `scheduled()` passes `env` → `twitchCronEnqueueMessages` (3-msg fan-out in prod) | Done |
| Legacy `poll_platform` full mode does not double-enqueue fan-out | Done |
| Production `max_batch_size=3` matches `PLATFORM_QUEUE_FANOUT.twitch` | Done |
| Staging `*/5` + `shards_only` + `LIVE_SWEEP_MAX_PAGES=3` | Done |
| Production `cpu_ms=30000`, `LIVE_SWEEP_MAX_PAGES=40`, `GAME_PASS_GAMES_PER_CYCLE=5` | Done |
| Helix budget math ↔ wrangler vars (`helix-budget.spec.ts`) | Done |
| Per-stream poll batching (`twitch-live-batch.ts`) | Done |
| Game rankings eligibility via JOIN (not nested EXISTS) | Done |
| Poll/reconcile close open sessions when Helix offline; stream id rotation in batch ingest | Done |
| `channels_live` counts open sessions with sample in last 5 min (not stale `ended_at IS NULL`) | Done |
| `viewer_samples(sampled_at)` + hot path indexes `0007`/`0008` | Done |
| Public `/v1/*` rate limit; `/health` minimal + `?detailed=1` gated | Done |
| In-worker rankings cache 60s | Done |
| Pages SSR direct D1 rollups + `Cache-Control` on ranking pages | Done |
| Pages `platform.env` TWITCH vars parity with ingest production | Done |
| Homepage rankings dedupe via `loadOverview` | Done |
| No `*/2` Kick/YouTube cron in wrangler (queue stubs no-op) | Done |
| `SAMPLE_ARCHIVE_ENABLED=0` production default | Done |

## Local verify (agent)

```bash
bun run test:ingest   # 259 passed (2026-06-03)
bun run test:web
bun run check:web
```

Optional: `bun run verify:twitch` (requires ingest on :8787) — 6/6 steps passed 2026-06-03.

## External / operator-only (not code gaps)

| Item | Owner |
|------|--------|
| Workers Paid subscription + `wrangler deploy --env production` | Operator |
| Cloudflare dashboard D1/Queue/CPU alerts | Operator |
| `wrangler secret put` for Twitch credentials | Agent/runbook per [15-ingest-runbook.md](../15-ingest-runbook.md) |
| Add `*/2` cron for Kick/YouTube after 14d green Twitch-only metrics | Phase 3 gate |
| KV cross-isolate rankings cache | P2 optional |
| R2 Parquet cold archive | Phase 4 |

## Related audits

Full index: [23 § Audit doc map](../23-audit-remediation-plan.md#audit-doc-map-no-duplicate-reading).

- [cloudflare-free-tier-audit.md](./cloudflare-free-tier-audit.md) — baseline limits (historical severity tables)
- [ingest-d1-query-audit.md](./ingest-d1-query-audit.md)
- [23-paid-tier-zero-overage-playbook.md](../23-paid-tier-zero-overage-playbook.md)
