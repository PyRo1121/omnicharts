# Ingest runbook

Operations guide for `workers/ingest`. Read with [11-cloudflare-deployment.md](./11-cloudflare-deployment.md).

---

## Schedule (production)

| Cron | UTC | Action |
|------|-----|--------|
| `*/1 * * * *` | every minute | Enqueue `poll_platform: twitch` |
| `*/2 * * * *` | every 2 min | Enqueue `poll_kick_tracked`, `poll_youtube_tracked` (when `MULTI_PLATFORM_CRON` enabled) |
| `0 */6 * * *` | every 6h | Enqueue `discover_twitch`, `discover_kick`, `sync_eventsub_twitch` |
| `15 0 * * *` | 00:15 | Enqueue `rollup_daily` |

**Cron handlers must only enqueue** — see [11](./11-cloudflare-deployment.md).

---

## Queue message types

| `type` | Payload | Consumer action |
|--------|---------|-----------------|
| `poll_platform` | `{ platform: 'twitch' }` | **Coverage cycle** — global sweep + rotating game pass + reconcile ([ADR-0006](./adr/0006-twitch-pagination-coverage.md)) |
| `poll_platform` | `{ platform: 'kick' \| 'youtube' }` | Enqueues tracked poll message via [`platform-coverage.ts`](../workers/ingest/src/platform-coverage.ts) |
| `poll_kick_tracked` | — | Kick `GET /public/v1/livestreams` catalog batch |
| `poll_youtube_tracked` | — | YouTube `videos.list` on `channels.youtube_live_video_id` |
| `discover_kick` | — | Kick category discovery; writes `kick_discovery_seed_at` metadata |
| `poll_channel_batch` | `{ platform, channel_ids[] }` | Optional catalog re-poll by `user_id` (admin backfill only) |
| `rollup_daily` | `{ date? }` | Close sessions; upsert daily rollups |
| `discover_twitch` | — | Supplemental top-games scan + `game_categories` |
| `sync_eventsub_twitch` | — | Create missing `stream.online` / `stream.offline` webhook subs (batched) |

Idempotency: `UNIQUE(stream_session_id, sampled_at)` on samples.

---

## Secret rotation

### Phase 3 platform secrets (Kick, YouTube)

| Variable | Required for |
|----------|----------------|
| `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` | Kick discover + poll (`NEEDS_API` when absent) |
| `KICK_WEBHOOK_PUBLIC_KEY` | Optional `POST /webhooks/kick/events` lifecycle |
| `YOUTUBE_API_KEY` | YouTube tracked poll + live video id refresh (`NEEDS_API` when absent) |

Sync with `wrangler secret put` from `workers/ingest` (same flow as Twitch above). See [05-ingestion-per-platform](./05-ingestion-per-platform.md).

### Platform API secrets (Twitch, YouTube, Kick)

1. Create new secret in provider console.
2. `cd workers/ingest && npx wrangler secret put TWITCH_CLIENT_SECRET` (repeat per key).
3. Deploy ingest; verify `/health` lag normal.
4. Revoke old secret in provider console.

### `ADMIN_API_KEY` rotation (mutating `/admin/*`)

Env name in code and `.dev.vars.example`: **`ADMIN_API_KEY`** (not `ADMIN_SECRET`).

1. Generate a new random key (≥32 chars).
2. From `workers/ingest`: `printf '%s' "$NEW_KEY" | npx wrangler secret put ADMIN_API_KEY`
3. Deploy ingest Worker (`npx wrangler deploy` or CI).
4. Update local `workers/ingest/.dev.vars` and any automation (`scripts/ingest/ingest-admin-curl.ts`, `twitch:checkpoint`) that send `Authorization: Bearer …`.
5. Smoke: `bun run ingest:cron` or `bun run twitch:discover` — expect 200 with new key, 401 with old/missing.
6. Revoke awareness of the old key (rotate CI secrets; do not commit values).

Never paste secret values into git or docs.

---

## Local Twitch credentials

| File | Purpose |
|------|---------|
| `workers/ingest/.dev.vars` | Local secrets (gitignored). **Not** the repo root `.dev.vars`. |
| `workers/ingest/.dev.vars.example` | Template to copy |

| Variable | Required for |
|----------|----------------|
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Helix discover/poll, EventSub API calls |
| `TWITCH_EVENTSUB_SECRET`, `TWITCH_EVENTSUB_CALLBACK_URL` | Creating webhook subscriptions (`bun run twitch:eventsub-sync`) |

Production uses `wrangler secret put` for secrets; ingest caps (`INGEST_COVERAGE_MODE`, `TWITCH_*`, `LIVE_SWEEP_MAX_PAGES`, archive flags) are baked in `wrangler.jsonc` `env.production.vars` — see [23-paid-tier-zero-overage-playbook](./23-paid-tier-zero-overage-playbook.md#4-knobs-to-stay-in-bundle).

**Agents:** Sync production secrets from `workers/ingest/.dev.vars` (parse each line on the first `=` only). For each non-empty key among `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_EVENTSUB_SECRET`, `TWITCH_EVENTSUB_CALLBACK_URL`, run from `workers/ingest`:

```bash
printf '%s' "$VALUE" | wrangler secret put KEY
```

(Wrangler 4.x has no `--remote` flag; `secret put` updates the deployed Worker.) Never ask the user to paste secrets manually. Do not commit `.dev.vars`.

**Local ingest URL:** `http://127.0.0.1:8787` (pinned in `workers/ingest/wrangler.jsonc` `dev.port`). If the port is busy, stop stray `wrangler dev` processes before starting again.

**Wrangler dev (ingest workspace):** `bun run dev:ingest` runs `wrangler dev --test-scheduled --show-interactive-dev-session false`. On first run, `scripts/dev/wrangler-decline-skills.ts` writes `~/.wrangler/agents-skills-install.jsonc` with `accepted: false` so Wrangler 4.95+ does not block on the interactive Cloudflare agent-skills install prompt (decline once globally; use `wrangler --install-skills` only if you want them). `dev.generate_types` is `false` in `wrangler.jsonc` to avoid hot-reload loops from `worker-configuration.d.ts` churn — regenerate types explicitly after binding changes.

**Types:** From repo root, `bun run types:ingest` (uses the ingest workspace’s Wrangler 4.97, not a global install). Re-run after editing `wrangler.jsonc` bindings.

**Simulate cron locally:** With ingest running:

```bash
bun run ingest:cron                              # default: */1 * * * * (Twitch poll enqueue)
bun run ingest:cron "15 0 * * *"                 # rollup_daily
bun run ingest:cron "0 */6 * * *"                # discover_twitch + eventsub sync
```

Hits `GET /__scheduled?cron=…` (Wrangler dev middleware; requires `--test-scheduled`).

**If admin returns `Twitch credentials not configured`:** the running `wrangler dev` was started before `.dev.vars` existed or was edited. Restart ingest and check health:

```bash
bun run dev:ingest
curl -sS http://127.0.0.1:8787/health | jq .twitch   # expect "configured"
bun run ingest:cron                                 # optional: exercise scheduled → queue
bun run twitch:eventsub-sync
```

With app credentials only, sync returns HTTP 200 and `stats.errorSamples` mentioning missing EventSub env — not 503.

---

## Phase 1 Twitch checkpoint (agents)

**Agents run this end-to-end** — do not ask the user to run manual `curl` chains or the individual `twitch:*` scripts for Phase 1 verification.

```bash
bun run twitch:checkpoint
```

Script: `scripts/verify/twitch-phase1-checkpoint.ts`. It:

1. Verifies `workers/ingest/.dev.vars` exists (not values)
2. Runs `bun run d1:migrate:local`
3. Waits for `GET http://127.0.0.1:8787/health` (starts `bun run dev:ingest` in background if unreachable)
4. Fails if `health.twitch` ≠ `configured` (restart ingest after editing `.dev.vars`)
5. Runs discover → poll → optional enrich → rollup → rankings → channel detail
6. Prints a pass/fail summary table; exit `0` only if critical steps pass

Flags: `--no-start-ingest` (do not spawn ingest), `--no-enrich` (skip profile enrichment), `--full` (coverage cycle poll instead of quick sweep ×2).

Quick poll (`{ "quick": true }`) runs a **3-page global live sweep** (writes `viewer_samples`), not catalog poll of `tracked` IDs only. Checkpoint rolls up **today UTC** (samples are written “now”), runs the sweep twice so `discovered` channels can promote to `tracked`, and expects `items>0` on rankings. Local `wrangler.jsonc` sets `TWITCH_RANKING_MIN_AIRTIME_MINUTES=1`; production should use `60`.

`bun run twitch:checkpoint:full` — same flow with full `runTwitchCoverageCycle` instead of quick sweeps (slow; use when debugging coverage).

If ingest is not running, start it in another terminal or let the checkpoint spawn it:

```bash
bun run dev:ingest
```

---

## Manual replay

**Local:**

```bash
# Re-run rollup for yesterday UTC (or pass date in JSON body)
bun run rollup:daily

# Phase 1 demo: 20 channels × 7d rollups (no Helix required)
# Requires migration 0003 locally first: bun run d1:migrate:local
bun run dev:seed-rankings

# Top 20 by hours watched (7d)
bun run twitch:rankings
```

**Production:**

- `POST /admin/rollup/daily` with optional `{ "date": "YYYY-MM-DD" }`.
- Enqueue `rollup_daily` with `{ "date": "2026-05-30" }` via queue tooling.
- Do not re-insert duplicate samples without idempotent keys.

### Public rankings API (Phase 1)

`GET /v1/rankings/channels?platform=twitch&period=7d&limit=20`

| `period` | Window |
|----------|--------|
| `24h` | 1 day |
| `7d` | 7 days (default) |
| `30d` | 30 days |
| `90d` | 90 days |

Kick returns rollup-backed `items[]` when discover + poll + `rollup_daily` have run. YouTube rankings stay empty until channel rollups exist; poll + `youtube_live_video_id` writer are live when `YOUTUBE_API_KEY` is set.

Rankings apply [eligibility rules](./12-channel-discovery-and-tracking.md#ranking-eligibility): `ingest_state = tracked`, ≥60 min airtime in period, period average viewers ≥ `TWITCH_MIN_VIEWERS`.

### Discovery seed

```bash
bun run twitch:discover   # POST /admin/twitch/discover — top games scan + discovery_seed_at metadata
```

### Agency watchlist import (Phase 4)

Bulk promote channels to `ingest_state = tracked` for agency watchlists.

```bash
curl -sS -X POST http://127.0.0.1:8787/admin/watchlist/import \
  -H "X-Admin-Api-Key: $ADMIN_API_KEY" \
  -H "content-type: text/csv" \
  --data-binary $'platform,slug\ntwitch,ninja\nkick,xqc'
```

JSON body alternative: `{ "csv": "platform,slug\ntwitch,ninja" }`.

Per-row `needs_api` when platform secrets missing (same `NEEDS_API` gates as discover/poll). Re-run after credentials configured. See [07-api-spec](./07-api-spec.md#agency-watchlist-import-phase-4-admin).

---

## Incident: rankings stale

1. Check `/health` → `ingest_lag_seconds`
2. Cloudflare dashboard → Queue depth, DLQ
3. Twitch status / quota headers (`Ratelimit-Remaining`)
4. If D1 write limit hit → reduce tracked set; prune samples
5. Post banner on site if lag &gt; 15 min

---

## Incident: platform 429 storm

1. Pause consumer (disable cron temporarily)
2. Increase backoff (start 30s, max 5m)
3. Drop `dormant` tier from poll batches first
4. Resume cron when `Ratelimit-Remaining` stable

---

## Incident: EventSub desync (Twitch)

1. Reconcile: poll `GET /streams` for all `tracked` channels once
2. Compare to `stream_sessions` table (open rows: `ended_at IS NULL`)
3. Re-subscribe webhooks if subscription count drift ([ADR-002](./adr/0002-twitch-eventsub-vs-polling.md))

---

## Deploy checklist

**Order:** schema → ingest → Pages. CLI details: [19](./19-project-scaffold-and-commands.md). Freeze gate: [23](./23-audit-remediation-plan.md#2-freeze-gate-twitch-frozen--kick-may-start).

1. **D1 migrations (canonical cwd `workers/ingest`)**
   - [ ] `bun run d1:migrate:remote` from repo root (or `cd workers/ingest && npx wrangler d1 migrations apply omnicharts --remote`)
   - [ ] `bun run d1:verify-schema:remote` — tables/columns through `0006` ([13](./13-testing-and-verification.md))
2. **Ingest Worker**
   - [ ] Production vars: `TWITCH_RANKING_MIN_AIRTIME_MINUTES=60`, `TWITCH_MIN_VIEWERS=20` ([12](./12-channel-discovery-and-tracking.md), `wrangler.jsonc` `env.production`)
   - [ ] Secrets: `TWITCH_CLIENT_*`, EventSub, **`ADMIN_API_KEY`** ([rotation](#admin_api_key-rotation-mutating-admin) above)
   - [ ] `cd workers/ingest && npx wrangler deploy`
   - [ ] `GET /health` — `ingest_lag_seconds.twitch` &lt; 120s; `twitch` = `configured`
3. **Pages / web**
   - [ ] Deploy SvelteKit after ingest (schema + API stable)
   - [ ] Spot-check `/`, `/channels/{slug}`, rankings vs yesterday
4. **Post-deploy smoke**
   - [ ] `GET /v1/rankings/channels?platform=twitch&period=7d&limit=5` — non-empty when ingest healthy
   - [ ] No `POST /admin/dev/*` in production (404 unless `ALLOW_DEV_SEED=1`)

### Kick / YouTube cron

`MULTI_PLATFORM_CRON` (`*/2 * * * *`) enqueues **`poll_kick_tracked`** and **`poll_youtube_tracked`** via `multiPlatformCronMessages()` (`workers/ingest/src/cron-messages.ts`, `workers/ingest/src/ingest-budget.ts`). Kick poll/discover and YouTube tracked poll are implemented.

**Deferred (budget gate):** production `wrangler.jsonc` may keep the `*/2` trigger commented until the 14-day ingest budget review passes — staging/local dev can run the cron. Re-enable production schedule only after `ingest-budget` sign-off ([23-paid-tier-zero-overage-playbook](./23-paid-tier-zero-overage-playbook.md)).

**Ops note:** staging and production must not share the same D1 database id — use separate `database_id` per environment in `wrangler.jsonc` / Pages bindings ([11-cloudflare-deployment](./11-cloudflare-deployment.md)).

---

## Staging

- Cron `*/5 * * * *` only
- Separate D1 preview database
- Never point staging ingest at production D1
