# Agent 1: Kick + YouTube Ingest Review

**Scope:** `workers/ingest/src/kick/**`, `workers/ingest/src/youtube/**`, related tests, `docs/05-ingestion-per-platform.md`, `docs/adr/0003-kick-ingest-strategy.md`  
**MCP:** Context7 quota exceeded (used Exa + GitNexus + Cloudflare docs). GitNexus traced `runKickCatalogPoll` → queue/cron (`proc_70_scheduled`), `handleKickWebhook` → RSA verify (`proc_65_handlekickwebhook`), `runYoutubeCatalogPoll` → queue handler (`proc_62_handlequeuemessage`).

## Data flow (Phase 1 map)

| Platform | Discover | Poll queue | Poll API | Session / sample keys | Rollup input |
|----------|----------|------------|----------|----------------------|--------------|
| Kick | `discover_kick` (6h) → `GET /public/v2/categories` + category `livestreams` (`discover.ts`) | `poll_kick_tracked` (`*/2`) | `GET /public/v1/livestreams` ≤50 `broadcaster_user_id` (`poll.ts`, `api.ts`) | `platform_stream_id` = `{channel_id}-{started_at}`; session id `kick-sess-{channel_id}-{startedKey}` (`stream-fields.ts`, `kick-live-batch.ts`); optional webhook `livestream.status.updated` (`webhook/lifecycle.ts`) | `viewer_samples` via `batchRecordKickLiveSamples` → hourly/daily rollup |
| YouTube | On-demand `channels.list` seed/resolve only — **no cron discover** (`seed.ts`, `resolve-channel.ts`) | `poll_youtube_tracked` (`*/2`) | `videos.list` ≤50 `id`, `part=liveStreamingDetails,snippet` (`poll.ts`, `api.ts`) | `platform_stream_id` = video id; session id `yt-sess-{UC}-{startedKey}` (`youtube-live-batch.ts`) | Same sample → rollup path |

**Plan alignment:** Matches ADR-003 and docs/05 — official APIs only, Kick category discovery + tracked poll, YouTube tracked video-id poll, `NEEDS_API` when secrets missing, hidden viewer counts → no fabricated zeros, no cron `search.list`.

## Citations used

- [Kick Livestreams API](https://docs.kick.com/apis/livestreams) — `GET /public/v1/livestreams` accepts up to 50 `broadcaster_user_id` query params; response includes distinct `channel_id` and `broadcaster_user_id`.
- [Kick webhook security](https://github.com/KickEngineering/KickDevDocs/blob/main/events/webhook-security.md) — Signed payload `message_id.timestamp.rawBody`; RSA PKCS#1 v1.5 + SHA-256; `Kick-Event-Message-Id` is idempotency key.
- [Kick event types — livestream.status.updated](https://docs.kick.com/events/event-types) — Webhook payload includes `broadcaster.user_id`, `channel_slug`, `is_live`, `started_at`; **no `channel_id` field** in published examples.
- [YouTube videos.list](https://developers.google.com/youtube/v3/docs/videos/list) — Quota cost 1 unit per call; up to 50 comma-separated `id` values per request.
- [YouTube Video resource](https://developers.google.com/youtube/v3/docs/videos) — `snippet.liveBroadcastContent` for live state; `liveStreamingDetails.concurrentViewers` may be absent while live (hidden counts).
- [YouTube quota costs](https://developers.google.com/youtube/v3/determine_quota_cost) — `search.list` = 100 units (forbidden in cron per docs/05); `videos.list` / `channels.list` / `playlistItems.list` = 1 unit each.
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/) — Max 100 bound parameters per query; batch chunking required (implemented in `d1-batch.ts`).

## Findings

| Sev | File:line | Issue | Citation / evidence | Recommendation |
|-----|-----------|-------|---------------------|----------------|
| P0 | `workers/ingest/src/kick/webhook/lifecycle.ts:44-52` | **Session key mismatch:** Webhook session IDs use `kickApiChannelId` resolved from optional `channel_id` fields, then `ingest_metadata`, then **`broadcaster.user_id` fallback**. Poll path always uses API `stream.channel_id` (`kick-live-batch.ts:389-390`). Official `livestream.status.updated` payloads omit `channel_id` ([event-types](https://docs.kick.com/events/event-types)); tests use synthetic `channel_id: 99` (`kick-webhook-lifecycle.spec.ts:26-36`) while `db-kick-live-batch.spec.ts` uses `broadcaster_user_id: 42` / `channel_id: 420`. Webhook-before-first-poll creates `kick-sess-{user_id}-…`; poll creates `kick-sess-{channel_id}-…` → split sessions and broken HW. | [Kick livestreams schema](https://docs.kick.com/apis/livestreams) shows both IDs; [webhook payload](https://docs.kick.com/events/event-types) has only `user_id`. GitNexus: `applyKickLivestreamStatusUpdated` only called from `handleKickWebhook`. | On `is_live`, resolve Kick `channel_id` before session write: `GET /public/v1/channels?slug=` (or `broadcaster_user_id`) via existing `KickPublicApiClient`; never fall back to `user_id` for `platform_stream_id`. Add test with official payload shape (no `channel_id`). |
| P1 | `workers/ingest/src/youtube/api.ts:39-43` | **No quota / rate-limit handling:** `fetch` throws on non-OK; no retry or shed for `403 quotaExceeded` / `429`. One quota breach fails entire `runYoutubeCatalogPoll` batch. | [Quota costs](https://developers.google.com/youtube/v3/determine_quota_cost); docs/05 quota math @ 10k units/day. | Parse error JSON for `quotaExceeded`; log metric, skip cycle or shed dormant tier; optional backoff like Kick `429` handling (`kick/api.ts:130-133`). |
| P1 | `workers/ingest/src/youtube/poll.ts:54-65` | **Bootstrap quota spike:** `bootstrapYoutubeLiveVideoIds` runs sequentially per tracked row missing `youtube_live_video_id`, each calling `channels.list` + `playlistItems.list` (2 units/channel) inside every poll cron. Up to `youtubeMaxTrackedFromEnv` (default 120) × 2 units per 2-minute tick if many rows lack ids. | [playlistItems.list / channels.list = 1 unit](https://developers.google.com/youtube/v3/determine_quota_cost); docs/05 steady-state assumes known `youtube_live_video_id`. | Cap bootstrap batch size per cycle; defer overflow to admin seed; or queue separate `bootstrap_youtube_live_ids` message with budget. |
| P1 | `workers/ingest/src/youtube/poll.ts:110-115` | **Deferred sample after video-id refresh:** When stale video id is refreshed mid-batch, code `continue`s without re-fetching `videos.list` for the new id — live channel gets no sample until next cron (~120s gap). Test asserts refresh only (`youtube-poll.spec.ts:117-157`), not same-cycle sample. | [videos.list](https://developers.google.com/youtube/v3/docs/videos/list) is the HW source per docs/05. | After `setYoutubeLiveVideoId`, call `getVideosByIds([refreshed])` and append to `sampleInputs` in same batch. |
| P1 | `workers/ingest/src/kick/poll.ts:109-121` | **Aggressive offline session close:** Tracked broadcasters absent from `livestreams` response trigger `closeOpenSessionsForPlatformChannelIds` every poll. Transient API omission or partial batch error (before throw) can false-close live sessions. Poll is authoritative per ADR-003, but no grace/reconcile counter. | [Livestreams API](https://docs.kick.com/apis/livestreams) returns only matching live rows; no documented “still live” sentinel for requested offline IDs. | Require N consecutive poll misses before close, or reconcile only when webhook `is_live: false` (if subscribed). |
| P1 | `workers/ingest/src/db/youtube.ts:4-11` | **Tracked channels without `youtube_live_video_id` excluded from poll:** `listYoutubePollTargets` requires non-null video id. Newly promoted tracked rows produce zero samples until bootstrap succeeds; bootstrap shares poll `limit` window with active pollers. | docs/05 steady-state pattern. | Prioritize bootstrap queue; surface `youtube_live_video_id` null count in health/status for ops. |
| P2 | `workers/ingest/src/kick/webhook/handler.ts:41-48` | **Static webhook public key only:** `KICK_WEBHOOK_PUBLIC_KEY` env secret; no runtime fetch from `GET /public/v1/public-key`. Key rotation requires manual secret update + redeploy. | [Webhook security](https://github.com/KickEngineering/KickDevDocs/blob/main/events/webhook-security.md) documents fetchable public key endpoint. | Optional startup / periodic key fetch with PEM compare; keep env override for air-gapped dev. |
| P2 | `workers/ingest/src/kick/webhook/message-dedup.ts:5-74` | **Webhook dedup TTL 10m:** `claimKickWebhookMessageId` uses `ingest_metadata` with 10-minute freshness. Kick redelivery after TTL could re-apply lifecycle (re-open session). Low probability given ULID idempotency header semantics. | [Webhook security](https://github.com/KickEngineering/KickDevDocs/blob/main/events/webhook-security.md) — Message-Id is unique idempotent key. | Extend TTL or persist processed ids until stream session ended; return 204 on duplicate regardless of TTL. |
| P2 | `workers/ingest/src/kick/auth.ts:8-42` | **Module-global OAuth token cache:** `cached` token shared across requests in isolate; fine for single-tenant Worker but complicates multi-env local tests and offers no per-credential isolation. | Kick OAuth [client_credentials](https://github.com/KickEngineering/KickDevDocs/blob/main/getting-started/generating-tokens-oauth2-flow.md). | Document isolate behavior; key cache by `KICK_CLIENT_ID` hash if multi-tenant ever needed. |
| P2 | `workers/ingest/test/kick-webhook-lifecycle.spec.ts:21-40` | **Test gap masks P0:** Parity test injects `channel_id` into webhook event; does not assert behavior for [official payload](https://docs.kick.com/events/event-types) without `channel_id`. | Exa / KickDevDocs payload examples. | Add regression test: webhook with only `broadcaster.user_id` must produce same session keys as poll fixture (`channel_id: 420`, `broadcaster_user_id: 42`). |

## Strengths (no action)

- Kick RSA webhook verify matches documented concatenation (`webhook/verify.ts`); tests use Web Crypto round-trip (`kick-webhook-verify.spec.ts`).
- Hidden viewer handling correct: Kick `viewer_count` null/0 (`stream-fields.ts:25-27`); YouTube missing `concurrentViewers` (`stream-fields.ts:29-32`).
- API batch sizes align with docs: Kick 50 (`config.ts:6`), YouTube 50 (`config.ts:6`).
- D1 writers respect 100-bind / 50-statement batch caps (`d1-batch.ts`, `kick-live-batch.ts`, `youtube-live-batch.ts`).
- No cron `search.list` in YouTube path (`resolve-channel.ts:22`, `poll-platform.ts:3`).
- Kick rate budget + `Retry-After` on 429 (`rate-limit.ts`, `api.ts:130-133`).

## Summary

| Severity | Count |
|----------|-------|
| P0 | 1 |
| P1 | 5 |
| P2 | 4 |

**Top 3 risks**

1. **Kick webhook vs poll session ID split (P0)** — Official webhook lacks `channel_id`; fallback to `broadcaster_user_id` diverges from poll’s API `channel_id`, splitting `stream_sessions` and corrupting HW/AV when webhooks arrive before poll metadata.
2. **YouTube quota fragility (P1)** — No `quotaExceeded` handling plus per-poll sequential bootstrap (2 units × N channels) can halt or exhaust daily quota under growth.
3. **Kick false offline closes (P1)** — Poll treats missing livestream row as offline immediately; transient API gaps can prematurely end sessions and depress hours watched.
