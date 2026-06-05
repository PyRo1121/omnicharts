# GitNexus Phase 2–4 audit

**Date:** 2026-06-05  
**Tooling:** GitNexus MCP (`query`, `context`, `cypher`) + verification gates  
**Index:** `npx gitnexus analyze` — 5,169 nodes · 9,895 edges · 300 processes  
**Related:** [26-twitch-freeze](../26-twitch-freeze-execution-plan.md) · [phase3-signoff](./phase3-signoff.md) · [phase4-remediation](./phase4-remediation.md)

---

## Scope traced

| Phase | Area | GitNexus process / symbol evidence |
|-------|------|----------------------------------|
| **2 Twitch** | EventSub lifecycle | `proc_180_handletwitcheventsub` — `handleTwitchEventSubWebhook` → `verifyTwitchEventSubSignature` → `isValidTwitchEventSubSecret`; outgoing `handleNotification`, `markEventSubRevoked` |
| **2** | Helix poll/discover | `proc_13_queue` — `handleQueueMessage` → `runTwitchPollPlatform` → `enqueueTwitchPollShards`; `proc_195_scheduled` — `discoverTwitchCronMessages` |
| **2** | `rollup_daily` | `proc_74_rundailyrollup` — `runDailyRollup` → `resolveRollupDate` → `yesterdayUtcDateString`; callers `handleQueueMessage`, `adminRollupDaily`; callee `runRetentionWithColdArchive` |
| **2** | `verify:twitch` | `proc_75_main` — `twitch-e2e-verify.ts:main` → `runProofMatrix`; `proc_173_main` — `twitch-phase1-checkpoint.ts:main` |
| **3 Kick** | Poll + webhook | `proc_11_runkickpollbatch` — `runKickPollBatch` → `getKickAppAccessToken`; `proc_65_handlekickwebhook` / `proc_177_handlekickwebhook` — verify chain |
| **3 Kick** | Webhook → DB | Cypher: `handleKickWebhook` → `applyKickLivestreamStatusUpdated` (`kick/webhook/handler.ts` → `lifecycle.ts`) |
| **3 YouTube** | Poll/seed | `proc_62_handlequeuemessage` — `runYoutubePollPlatform` → `runYoutubeCatalogPoll`; defs `seedYoutubeChannels`, `searchChannelsWithYoutubeSeed` |
| **3** | Multi-platform health | `buildPublicHealth` in `health/status.ts`; `proc_70_scheduled` — `multiPlatformCronMessages` → `kickYoutubePollMessages` |
| **3** | `platform=` web loaders | `proc_37_buildrankingschannel` — `buildRankingsChannelsResponse` → `topChannelsByHoursWatchedSql`; `proc_163_load` — `/channels` `parseUiPeriod` |
| **4** | CSV export | `proxyIngestResponse` callers (cypher): channel detail + rankings channels/games `+server.ts` GET; `rankingsChannelsCsvUrl`, `channelDetailToCsv` |
| **4** | 90d prune / cold archive | `proc_85_runretentionwithcold` — `runRetentionWithColdArchive` → `archiveAndPruneChannelRollups` → `encodeRowsToParquet` → R2; `deleteRollupsByRowid` batch via `json_each` |
| **4** | Compare | `buildCompareChannelsResponse` → `loadCompareSide` → `buildChannelDetailResponse`; BFF fallback composes two ingest channel-detail fetches |
| **4** | Watchlist | `proc_46_importwatchlistcsv` — `importWatchlistCsv` → `hasTwitchAppCredentials`; caller `adminWatchlistImport` (cypher) |
| **4** | VOD backfill | `proc_147_admintwitchvodbackfi` — `adminTwitchVodBackfill` → `staleBeforeIso`; `prepareVodSessionUpsert` |
| **4** | Language filter | `parseUiLanguage` → `parseOptionalLanguageParam` (`platform.svelte.ts`); `buildRankingsChannelsResponse` language SQL path |

### Hot-path `context()` summaries

| Symbol | Callers (graph) | Callees (graph) | Notes |
|--------|-----------------|-----------------|-------|
| `runDailyRollup` | `handleQueueMessage`, `adminRollupDaily` | `runRetentionWithColdArchive`, follower snapshots, `markChannelsDormantWithoutRecentActivity` | Rollup→retention chain intact |
| `applyKickLivestreamStatusUpdated` | `handleKickWebhook` (cypher), tests | `closeStaleOpenSessionsForChannel`, D1 upserts | Context missed handler caller; cypher confirmed |
| `importWatchlistCsv` | `adminWatchlistImport`, tests | `parseWatchlistCsv`, `importWatchlistRows` | Admin route wired |
| `buildCompareChannelsResponse` | compare API route (cypher partial), tests | `loadCompareSide` | Context shows tests only — SvelteKit route edge gap |
| `enrichSearchResultsWithRollups` | `search/+page.server.ts` load, tests | `loadChannelDetail` | Wired in page loader |
| `proxyIngestResponse` | 3 BFF CSV/JSON proxy routes | — | `Content-Disposition` forward (phase4 P1-01) |

---

## Findings

### P0 — none

No production-breaking defects in traced flows. All verification gates green (below).

### P1 — none

Phase 4 remediation items ([phase4-remediation](./phase4-remediation.md)) remain closed. No new regressions in caller chains under audit.

### P2 — graph / tooling gaps (not code defects)

| ID | Issue | Evidence | Recommendation |
|----|-------|----------|----------------|
| P2-01 | `context()` under-reports SvelteKit `+server.ts` and `index.ts` fetch-router callers | `buildCompareChannelsResponse`, `handleTwitchEventSubWebhook`, `handleKickWebhook` show test-only incoming in `context()`; grep/cypher confirm production callers | Use cypher `CALLS` + grep to cross-check hot paths; re-run `analyze` after large route refactors |
| P2-02 | `HandleKickWebhook` process stops at RSA verify | `proc_65`/`proc_177` lack `applyKickLivestreamStatusUpdated` steps | Extend process tracing or manually follow `lifecycle.ts` for webhook→DB audits |
| P2-03 | EventSub process omits `handleNotification`→lifecycle DB writes | `proc_180` ends at signature verify / dedup | Same as P2-02 for Twitch EventSub |
| P2-04 | Repo was not indexed at audit start | `list_repos` showed only Radar + llm-self-training | CI/agent hook: run `npx gitnexus analyze` on Stream Charts after merge |

---

## Cross-check vs freeze / sign-off docs

| Doc | Claim | Audit result |
|-----|-------|--------------|
| [26](../26-twitch-freeze-execution-plan.md) G1 | `verify:twitch` 6/6 local | **Confirmed** 2026-06-05 |
| [26](../26-twitch-freeze-execution-plan.md) G2–G3, G11–G12 | Remote D1 / prod vars / maintainer sign-off open | **Unchanged** — ops deferrals, not code |
| [phase3-signoff](./phase3-signoff.md) | MVP gates all PASS | **Confirmed** — kick/youtube/twitch/e2e |
| [phase4-remediation](./phase4-remediation.md) | P0/P1 = 0 | **Confirmed** — cold-archive batch delete, CSV proxy, period validation, watchlist coverage |

---

## Verification gates (2026-06-05)

Prerequisite: `bun run dev:ingest` (local).

| Gate | Command | Result |
|------|---------|--------|
| Twitch full | `bun run verify:twitch` | **PASS** 6/6 |
| Kick | `bun run verify:kick` | **PASS** 5/5 (live discover skipped — no `KICK_*` in running ingest) |
| YouTube | `bun run verify:youtube` | **PASS** 2/2 |
| Ingest coverage | `bun run test:ingest:coverage` | **PASS** (twitch, db, kick, youtube, r2, watchlist ≥80%) |
| Web unit | `bun run test:web` | **PASS** 98 tests |
| E2E | `bun run test:e2e` | **PASS** 31 passed, 6 skipped (live-data optional) |

---

## Fix loop

| Iteration | Action | Outcome |
|-----------|--------|---------|
| 1 | GitNexus trace + gate run | No P0/P1 code bugs; P2 graph gaps documented |
| 2 | — | Skipped (no P0/P1 to fix) |

---

## Summary

| Metric | Value |
|--------|-------|
| Processes traced | **30+** (8 query batches + cypher process steps) |
| Findings | **4 P2** (tooling/graph), **0 P0**, **0 P1** |
| P0 remaining | **0** |
| P1 remaining | **0** |
| Fix iterations used | **1** (audit only) |
