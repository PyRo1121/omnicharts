# Remediation grounding audit (doc 24)

**SSOT:** Phase 0–2 **operational matrix** (proof commands). Backlog: [23](./23-audit-remediation-plan.md). Gate status: [26](./26-twitch-freeze-execution-plan.md). Verify commands: [13](./13-testing-and-verification.md). Do not duplicate [audits/cloudflare-free-tier-audit](./audits/cloudflare-free-tier-audit.md) — use [cloudflare-hardening-complete](./audits/cloudflare-hardening-complete.md) for current CF state.

**Related:** [25 dependency & API grounding](./25-dependency-and-api-grounding.md) (Helix, bindings, deps, toolchain pins).

**Date:** 2026-06-03  
**Scope:** Wave B/C ingest remediations (REM-008–014, REM-012) vs **official** Cloudflare + Twitch docs and OmniCharts docs 05/06/12/21, ADR-002/006.  
**Research:** Exa MCP (`web_search_exa`) for Twitch Helix followers `total`, D1 batched DELETE limits, Workers secrets/environments; repo `helix.ts`. Cloudflare docs MCP returned 401; Context7 quota exceeded. Playwright + SvelteKit E2E: Exa MCP (2025–2026 guides).

**Package / Helix / binding inventory:** [25-dependency-and-api-grounding](./25-dependency-and-api-grounding.md) (Helix direct, not Twurple; full dep table + endpoint map).

---

## Zero-WARN policy (Twitch freeze)

Before Phase 3 Kick, **every row** in the [Twitch Phase 0–2 operational matrix](#twitch-phase-02-operational-matrix) must be **OPERATIONAL**. **NEEDS_PROOF** or **BLOCKED** stops the freeze gate ([23 §2](./23-audit-remediation-plan.md#2-freeze-gate-twitch-frozen--kick-may-start)) except **documented prod-only proofs** (EventSub prod callback; G3 deploy vars screenshot). **G1** ✅ and **G2** ✅ remote D1 (2026-06-03) per [26](./26-twitch-freeze-execution-plan.md).

| Rule | Meaning |
|------|---------|
| **OPERATIONAL** | Code + tests exist; proof command passes locally or in CI with documented env |
| **NEEDS_PROOF** | Implemented but requires operator run (remote D1, prod secrets, live Helix) |
| **BLOCKED** | Missing implementation or failing gate — fix before Kick |

Grounding-audit **WARN** rows below must be closed (doc fix, ops checklist, or code) and reflected in the matrix before sign-off.

---

## Twitch Phase 0–2 operational matrix

| Subsystem | Phase | Status | Proof command | Test / evidence |
|-----------|-------|--------|---------------|-----------------|
| **Discover** (game scan + channel upsert) | 0–1 | OPERATIONAL | `bun run twitch:discover` or checkpoint step `POST /admin/twitch/discover` | `workers/ingest/test/twitch-sweep-discover.spec.ts`, `scripts/verify/twitch-phase1-checkpoint.ts` |
| **Coverage** (poll / sweep / promote tracked) | 1 | OPERATIONAL | `bun run twitch:sweep` or checkpoint `POST /admin/twitch/poll` | `workers/ingest/test/coverage-cycle.spec.ts`, `twitch-poll.spec.ts` |
| **EventSub** (webhook + subscription sync) | 1–2 | NEEDS_PROOF | `bun run twitch:eventsub-sync` + Twitch callback URL reachable in prod; local: `bun run twitch:eventsub-local-proof` (in freeze-proof when env set) | `workers/ingest/test/eventsub-*.spec.ts`, `scripts/ingest/eventSub-local-proof.ts` |
| **Rollup** (daily HW / AV / followers_delta) | 1–2 | OPERATIONAL | `bun run rollup:daily` or checkpoint `POST /admin/rollup/daily` | `workers/ingest/test/rollup-daily-job.spec.ts`, `helix-to-rollup.integration.spec.ts`, `follower-snapshots.spec.ts` |
| **Rankings — channels** | 2 | OPERATIONAL | `bun run twitch:rankings` | `workers/ingest/test/channels-api.spec.ts`, `top-channels.spec.ts`, `ranking-eligibility.spec.ts` |
| **Rankings — games** (min airtime + min viewers on contributors) | 2 | OPERATIONAL | `bun run twitch:rankings:games` | `workers/ingest/test/top-games-ranking-sql.spec.ts`, `top-games.spec.ts` |
| **Search** (`/v1/search/channels`) | 2 | OPERATIONAL | `curl -sS 'http://127.0.0.1:8787/v1/search/channels?q=sh&platform=twitch&limit=5'` | `workers/ingest/test/search-channels.spec.ts`, `search-db.spec.ts` |
| **Slug resolve** (ingest JSON + web 301) | 2 | OPERATIONAL | `curl -sS 'http://127.0.0.1:8787/v1/channels/resolve?slug=OLD&platform=twitch'`; web `GET /channels/old` → 301 | `workers/ingest/test/channel-resolve.spec.ts`, `public-http-edge.spec.ts`; `apps/web/src/lib/server/channel.test.ts` |
| **Web loaders** (rankings, channel, game, overview) | 2 | OPERATIONAL | `bun run test:web` | `apps/web/src/lib/server/*.test.ts` |
| **Admin auth** (mutating POST `/admin/*`) | 0–2 | OPERATIONAL | `POST /admin/twitch/discover` without `X-Admin-Api-Key` → 401 when key set | `workers/ingest/test/admin-auth.spec.ts`, `public-http-edge.spec.ts` |
| **Admin checkpoint** (pipeline + headers) | 1 | OPERATIONAL | `bun run twitch:checkpoint --no-start-ingest` or `bun run twitch:freeze-proof` | `scripts/verify/twitch-phase1-checkpoint.ts`, `scripts/verify/twitch-e2e-verify.ts` |
| **M1 freeze proof matrix** | 2 | OPERATIONAL | `bun run twitch:freeze-proof` (requires `dev:ingest`) | `scripts/verify/twitch-e2e-verify.ts --proof-matrix`, [26](./26-twitch-freeze-execution-plan.md#m1--local-operational-proof) |
| **Cron → queue** | 1–2 | OPERATIONAL | `bun run ingest:cron` (local) or wrangler scheduled test | `workers/ingest/test/cron-messages.spec.ts`; also in `bun run twitch:freeze-proof` |
| **D1 schema** (migrations **0001–0008** — tables/columns through `0006`, indexes `0007`/`0008`) | 0–2 | OPERATIONAL | Local: `bun run d1:verify-schema` or `twitch:freeze-proof` (**PASS** 2026-06-03); Remote: `d1:migrate:remote` no-op + `d1:verify-schema:remote` **PASS** 2026-06-03 (G2) | `scripts/verify/verify-d1-schema.ts`, [15-ingest-runbook](./15-ingest-runbook.md) |
| **Prune samples** (14d hot window) | 2 | OPERATIONAL | Rollup path invokes prune; inspect row counts | `workers/ingest/test/prune-samples.spec.ts` |
| **Playwright smoke** (web) | 2 | OPERATIONAL | `bun run dev:ingest` (optional channel test) + `bun run test:e2e` | `apps/web/e2e/smoke.spec.ts` |
| **Full verify gate** | 2 | OPERATIONAL (local) | `bun run dev:ingest` then `bun run verify:twitch` (no `VERIFY_SKIP_CHECKPOINT`) | `scripts/verify/twitch-e2e-verify.ts`, [13](./13-testing-and-verification.md) |
| **Dependency grounding** (toolchain / lockfile) | 0–2 | OPERATIONAL | Review [25 § toolchain pins](./25-dependency-and-api-grounding.md#toolchain-pins); `bun install --frozen-lockfile` in CI | [25-dependency-and-api-grounding.md](./25-dependency-and-api-grounding.md), root `bun.lock` |

**CI default:** `verify:twitch` skips checkpoint unless `VERIFY_FULL=1` and ingest + secrets are wired ([13](./13-testing-and-verification.md)).

---

## Summary

| Area | Verdict | Notes |
|------|---------|--------|
| `followers_delta` / follower snapshots / daily rollup | **PASS** (WARN timing) | Helix exposes point-in-time `total` only; delta = today − prior snapshot is correct |
| `prune-samples` 14d retention | **PASS** | Matches doc 06; batched DELETE aligns with D1 migration guidance |
| `admin/auth.ts` / `ADMIN_API_KEY` | **PASS** | Production fail-closed 503; local bypass unchanged (`admin-auth.spec.ts`) |
| `channels-api` peak / airtime SQL | **PASS** | Period peak = `MAX(peak_viewers)`; AV = HW-weighted; airtime summed |
| OpenAPI vs `channel-api` (REM-014) | **PASS** | Daily + totals fields align |
| Game rankings eligibility | **PASS** | `queryTopGamesByAverageViewers` EXISTS enforces period AV ≥ `TWITCH_MIN_VIEWERS` (`top-games-ranking-sql.spec.ts`) |
| Cron `scheduled` handler | **PASS** | ES module `scheduled()`, not legacy `__scheduled` export name |
| Wrangler `env.production` | **PASS** (WARN deploy) | Production vars for thresholds; secrets non-inheritable per env |

**Code changes from this audit:** Comment fix in `follower-snapshots.ts` (misleading prior-snapshot doc). No functional FAIL fixes required.

---

## 1. `followers_delta` / `follower-snapshots.ts` / daily rollup

### Official Twitch semantics

| Source | Finding |
|--------|---------|
| [Get Channel Followers](https://dev.twitch.tv/docs/api/reference#get-channel-followers) | `GET /helix/channels/followers?broadcaster_id=` returns paginated `data` plus **`total`** (integer). No historical series or per-day breakdown in the response. |
| [Helix guide](https://dev.twitch.tv/docs/api/guide) | App access token + `Client-Id`; rate limits apply (1 point per call). |
| Repo `workers/ingest/src/twitch/helix.ts` | Reads `json.total` only — matches API. |

**Implication:** Daily “followers gained” must be derived from **successive point-in-time totals**, not from Helix history APIs.

### Implementation

| Piece | Behavior |
|-------|----------|
| `computeFollowersDelta(today, prior)` | `today − prior` when both non-null; else `null` |
| `fetchFollowerCountsByChannelId` | Reads `channels.follower_count` (updated by profile enrichment / Helix) |
| `fetchPriorFollowerSnapshots` | Reads `ingest_metadata` keys `follower_eod:{channelId}` |
| `storeFollowerSnapshots` | After rollup, writes current total to metadata for next run |
| `runDailyRollup` | Computes delta per channel with samples on rollup date |

**Verdict: PASS** — Matches Helix capabilities and doc 05 (“Follower snapshot | 24h | Store EOD for delta”) interpreted as stored totals, not an API time series.

### Cadence (resolved)

| Item | Detail |
|------|--------|
| Pre-rollup enrichment | `runDailyRollup` calls `enrichFollowersBeforeRollup` (capped Helix refresh for channels with samples that UTC date) — `enrich-before-rollup.spec.ts`, `rollup-daily-job.spec.ts` |
| Doc 05 | Delta uses **consecutive stored Helix totals**, not Twitch calendar-day API |
| First day | `prior` missing → `followers_delta` null until second snapshot — expected |
| Rate cost | Capped at `ENRICH_MAX_CHANNELS_PER_RUN` per rollup |

---

## 2. `prune-samples.ts` — 14-day hot window

### Official Cloudflare

| Source | Finding |
|--------|---------|
| [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) | Large `DELETE`/`UPDATE` affecting many rows should run **in batches**; single huge statements risk duration limits (~30s). |
| Doc 06 | “Hot `viewer_samples`: **14 days** in D1; older → R2 Parquet.” |

### Implementation

| Constant | Value |
|----------|--------|
| `VIEWER_SAMPLE_RETENTION_DAYS` | 14 |
| `VIEWER_SAMPLE_DELETE_BATCH_SIZE` | 500 |
| Pattern | `DELETE … WHERE id IN (SELECT … LIMIT ?)` loop until batch &lt; size |

**Verdict: PASS** — Retention matches doc 06; batching matches D1 platform guidance.

---

## 3. `admin/auth.ts` — `ADMIN_API_KEY` on Workers

### Official Cloudflare

| Source | Finding |
|--------|---------|
| [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) | Secrets via `wrangler secret put`; accessed on `env`; never in wrangler source |
| [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/) | Secrets **non-inheritable** per environment; production: `wrangler secret put NAME --env production` |
| [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) | Do not store secrets in config; use `wrangler secret put` |

### Implementation

| Behavior | Assessment |
|----------|------------|
| `X-Admin-Api-Key` or `Authorization: Bearer` | Reasonable for machine-to-machine admin |
| POST-only guard (`isAdminPostPath`) | Matches REM-001 “mutating `/admin/*`”; GET `/admin/twitch/rankings*` mirrors public `/v1/*` (intentional) |
| Unset key + `ENVIRONMENT=production` | **503** `service_unavailable` — fail-closed (`admin-auth.spec.ts`) |
| Unset key (local dev) | Allow + one-time `console.warn` |

**Verdict: PASS** — Production rejects mutating `/admin/*` without secret; operators still use `wrangler secret put ADMIN_API_KEY --env production` ([15-ingest-runbook](./15-ingest-runbook.md)).

---

## 4. `channels-api` / `queryTopChannelsByHoursWatched` — peak & airtime

### SQL (period aggregation)

```sql
SUM(r.hours_watched) AS hours_watched,
SUM(r.airtime_minutes) AS airtime_minutes,
MAX(r.peak_viewers) AS peak_viewers,
(SUM(r.hours_watched) * 60.0 / NULLIF(SUM(r.airtime_minutes), 0)) AS average_viewers
```

| Metric | Verdict |
|--------|---------|
| `peak_viewers` | **PASS** — max of daily peaks in period (standard rollup semantics) |
| `airtime_hours` | **PASS** — `top-channels.ts` converts summed minutes → hours |
| `average_viewers` | **PASS** — period AV = total HW ÷ airtime hours ([04-metrics-glossary](./04-metrics-glossary.md)) |
| Eligibility | **PASS** — `ingest_state = 'tracked'`, `HAVING` airtime + period AV ≥ env thresholds |

Maps to OpenAPI nullable `peak_viewers` / `airtime_hours` on rankings items with numeric values when rollups exist (REM-010/013).

---

## 5. OpenAPI vs `channel-api` (REM-014)

| Field | OpenAPI `DailyMetricPoint` / totals | `buildChannelDetailResponse` |
|-------|-----------------------------------|------------------------------|
| `peak_viewers`, `airtime_hours`, `stream_count` | Required on daily | Present |
| `followers_gain` (totals) | Required, nullable | Sum of `followers_delta` when any day non-null |
| Per-day `followers_delta` | Not in public schema | Not exposed (totals only) — consistent |

**Verdict: PASS**

---

## 6. Game rankings eligibility

### Docs

| Doc | Rule |
|-----|------|
| [12-channel-discovery](./12-channel-discovery-and-tracking.md#ranking-eligibility) | Channel rankings: tracked + ≥60m airtime + period AV ≥ `TWITCH_MIN_VIEWERS` |
| [07-api-spec](./07-api-spec.md) | Games sorted by AV; no separate game-only viewer floor documented |

### SQL (`queryTopGamesByAverageViewers`)

- Game-level: `HAVING SUM(r.airtime_minutes) >= minAirtime`
- `EXISTS`: at least one **tracked** channel with `SUM(cr.airtime_minutes) >= minAirtime` in period for that game
- **EXISTS:** period AV ≥ `minAverageViewers` from `rankingQueryOptionsFromEnv` (same as channel rankings)

**Verdict: PASS** — `workers/ingest/test/top-games-ranking-sql.spec.ts`; `buildRankingsGamesResponse` passes env thresholds via `games-api.ts`.

---

## 7. Cron / `scheduled` handler

| Source | Repo |
|--------|------|
| [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) | `export default { async scheduled(event, env, ctx) }` |
| [Scheduled handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/) | Uses `event.cron`; local test `/cdn-cgi/handler/scheduled` |

**Note:** Cloudflare documents the **`scheduled()`** handler name. Legacy module workers used different export shapes; this codebase uses the current ES module pattern — **not** a misspelled `__scheduled` export.

`wrangler.jsonc` crons: `*/1`, `*/2`, `15 0 * * *`, `0 */6 * * *` → `cronToMessages` — **PASS**.

---

## 8. Wrangler `env.production`

| Source | Config |
|--------|--------|
| [Environments](https://developers.cloudflare.com/workers/wrangler/environments/) | `[env.production].vars`: `TWITCH_RANKING_MIN_AIRTIME_MINUTES=60`, `TWITCH_MIN_VIEWERS=20` |
| Root `vars` | Dev-friendly `TWITCH_RANKING_MIN_AIRTIME_MINUTES=1` — must deploy with `--env production` |

**Verdict: PASS** — `workers/ingest/test/wrangler-production-env.spec.ts`; optional deploy guard `scripts/verify/verify-wrangler-production-env.ts` (60/20).

---

## Research tool notes

| Tool | Result |
|------|--------|
| MCP `plugin-cloudflare-cloudflare-docs` | 401 authentication error |
| MCP Context7 Twitch | Monthly quota exceeded |
| WebFetch | Used for Cloudflare cron, scheduled handler, D1 limits, Twitch Get Channel Followers |
| Exa MCP | Playwright + SvelteKit E2E (`webServer` build+preview, role locators, CI workers) — [13](./13-testing-and-verification.md#playwright-e2e-rem-035) |

---

## Slop-risk register (for maintainers)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Claiming Helix provides daily follower history | High | Only `total`; cite Twitch reference |
| Equating “EOD snapshot” with rollup cron without enrichment schedule | Low | Pre-rollup `enrichFollowersBeforeRollup` in code + doc 05 |
| Game rankings inherit channel viewer floor | Low | EXISTS AV gate + `top-games-ranking-sql.spec.ts` |
| `ADMIN_API_KEY` unset in production | Medium | 503 fail-closed + deploy checklist + secret put |
| D1 unbounded DELETE | Medium | Already batched; cite D1 limits doc |
| OpenAPI “required” vs nullable confusion | Low | REM-013 nullable semantics documented in spec |

---

## References (official URLs)

- [Doc 25 — dependency & API grounding](./25-dependency-and-api-grounding.md)
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/wrangler/environments/
- https://dev.twitch.tv/docs/api/reference#get-channel-followers
- https://dev.twitch.tv/docs/api/guide
- https://dev.twitch.tv/docs/api/reference#get-streams
- https://dev.twitch.tv/docs/api/guide#pagination
