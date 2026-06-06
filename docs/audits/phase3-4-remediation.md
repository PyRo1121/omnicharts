# Phase 3–4 audit remediation

**Date:** 2026-06-05  
**Scope:** Close findings from [Agents 1–5](./phase3-4-review-executive-summary.md) Phase 3–4 MCP audits  
**Status:** Remediated in working tree (uncommitted)

---

## Verification

| Gate | Result |
|------|--------|
| `bun run lint` | PASS |
| `bun run test:ingest` | PASS |
| `bun run test:web` | PASS |
| `bun run check:packages` | PASS |
| `bun run check:web` | PASS (after compare link type fix) |
| `verify:wrangler-production` | Wired into `verify:twitch` |

---

## P0 — Kick webhook session keys

| Finding | Fix | Citation |
|---------|-----|----------|
| Webhook fell back to `broadcaster.user_id` when `channel_id` absent; poll uses API `channel_id` → split sessions | `resolveKickChannelIdForSession()` resolves via metadata → `GET /public/v1/channels` (slug / broadcaster id); **never** uses `user_id` as channel key; skips session write if unresolved | [Kick event-types — livestream.status.updated](https://docs.kick.com/events/event-types) (no `channel_id`); [Kick livestreams API](https://docs.kick.com/apis/livestreams) (`channel_id` vs `broadcaster_user_id`) |
| Test gap with synthetic `channel_id` | `kick-webhook-lifecycle.spec.ts` — official payload shape + metadata `channel_id=420` | Same |

**Files:** `workers/ingest/src/kick/webhook/lifecycle.ts`, `workers/ingest/src/kick/api.ts`, `workers/ingest/test/kick-webhook-lifecycle.spec.ts`

---

## P1 — Ingest

| Finding | Fix | Citation |
|---------|-----|----------|
| Kick false offline closes | 3 consecutive poll misses before `closeOpenSessions`; `last_seen_at` still updates each miss | ADR-003 poll authority + grace |
| YouTube `quotaExceeded` | `youtube/api-errors.ts` + structured log/skip in `youtube/api.ts` | [YouTube quota errors](https://developers.google.com/youtube/v3/docs/errors) |
| YouTube bootstrap spike | `YOUTUBE_BOOTSTRAP_MAX_PER_POLL = 10` cap per cron | [Quota costs](https://developers.google.com/youtube/v3/determine_quota_cost) |
| Same-cycle sample after video-id refresh | `sampleRefreshedYoutubeVideo()` in poll batch | docs/05 steady-state |
| Cold archive CPU burst | `COLD_ARCHIVE_MAX_BATCHES_PER_RUN = 50` on archive/prune loops | [Cloudflare R2](https://developers.cloudflare.com/r2/) ops |
| Doc 23 `COLD_ARCHIVE_ENABLED` gap | Knob rows in `docs/23-paid-tier-zero-overage-playbook.md` | doc 23 |

**Files:** `kick/poll.ts`, `kick/poll-offline-grace.ts`, `youtube/*`, `db/cold-archive.ts`

---

## P1 — Web + packages

| Finding | Fix | Citation |
|---------|-----|----------|
| CSV formula injection | OWASP `'` prefix for `=`, `+`, `-`, `@` in `escapeCsvCell`; tests | [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection) |
| Compare UI accepts invalid `period` | `compare/+page.server.ts` → `400` via `isComparePeriod` | `packages/rollup/src/compare-api.ts` |
| Methodology YouTube “not shipped” | Sync `docs/17-methodology-page.md` + `/methodology` copy + SEO meta | phase3-signoff |
| `platform=all` search copy | Honest Twitch-first subtitle in `platform.svelte.ts`; test | doc 16 |

**Files:** `packages/rollup/src/csv-export.ts`, `apps/web/src/routes/compare/+page.server.ts`, `methodology/+page.svelte`, `platform.svelte.ts`

---

## P1 — Cross-cutting (Agent 5)

| Finding | Fix |
|---------|-----|
| `verify:twitch` omits `verify:wrangler-production` | Added step after oxlint in `scripts/verify/twitch-e2e-verify.ts` |
| Freeze proof matrix says migrations `0001–0009` | Updated to `0001–0010` (VOD metadata migration shipped) |

---

## P2 — Implemented

| Finding | Fix |
|---------|-----|
| LiveNowStrip drops platform | `platform` prop + `routeWithPlatform('/channels', …)` |
| Channel breadcrumb omits platform | `/channels?platform={ch.platform}` |
| Compare discoverability | “Compare with another channel” on channel detail |
| Games CSV export UI | `ExportCsvLink` on `/games` |
| Search `language=` UI | `LanguageFilter` on `/search` |
| Invalid `language=` on `/channels` | User-visible note via `parseOptionalLanguageParam` |
| Footer platform context | `routeWithPlatform` for Channels/Games links |
| OpenAPI D3 search language echo | Optional `language` on `ChannelSearchResponse` + ingest echo when filter active |
| Metrics glossary 90d | Updated MVP column |
| E2E compare | `compare.spec.ts` — 90d toggle + invalid period 400 |

---

## P2 — Deferred (documented, not blockers)

| Finding | Rationale |
|---------|-----------|
| SearchChannels `$effect` refactor | Svelte MCP suggestions only; no runtime bugs — refactor when touching search UX |
| Kick webhook public key runtime fetch | Ops enhancement; env PEM override sufficient for MVP |
| Kick webhook dedup TTL 10m → longer | Low probability redelivery; track in ingest runbook |
| Kick OAuth module-global cache | Document isolate behavior; single-tenant Worker |
| Sidebar `$app/stores` → `$app/state` | Layout-wide migration; non-blocking |
| Homepage 24h/90d vs doc 09 tree | Product choice: expose extended periods; doc 09 can be updated separately |
| OpenAPI D2 `/v1` vs `/api/v1` prefix | Intentional BFF pattern (Phase 4 remediation) |
| OpenAPI D4 BadRequest code enum | Codes live in TS SSOT (`api-errors.ts`) by design |
| Agent 5: dedicated `parseHelixVideo` tests, json-guards coverage glob | Indirect coverage via helix-videos + VOD tests |
| Agent 5: GitNexus re-index | Ops task: `npx gitnexus analyze` |
| Parquet compression, VOD cursor semantics | Phase 4 ops backlog per agent3 |

---

## Citation policy

All fixes above trace to audit row → primary source (platform API, OWASP, Cloudflare docs, or project ADR/doc). Future contract changes follow [Agent 5 citation policy](./phase3-4-review-agent5-cross-cutting.md#citation-policy-going-forward).

---

## Next

1. User commit when ready (no auto-commit).  
2. Phase 5 deploy gates per [phase5-execution-plan](./phase5-execution-plan.md) (Cloudflare account ops).  
3. Optional: `bun run verify:twitch` with `dev:ingest` for full checkpoint path.
