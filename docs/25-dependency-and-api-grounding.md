# Dependency and API grounding (doc 25)

**Date:** 2026-06-03  
**Scope:** Bun workspaces (`apps/web`, `workers/ingest`), Twitch Helix (direct `fetch`), Cloudflare bindings, web stack.  
**Related:** [24-remediation-grounding-audit](./24-remediation-grounding-audit.md) (Twitch freeze matrix), [21-twitch-ingest-libraries](./21-twitch-ingest-libraries.md) (Twurple vs Helix direct), [11-cloudflare-deployment](./11-cloudflare-deployment.md), [audits/README](./audits/README.md).

**Research sources (2026-06-03):**

| Source | Status | Used for |
|--------|--------|----------|
| Exa MCP (`web_search_exa`) | Partial (rate limit on later queries) | Twurple 8.x, Twitch reference index, Queues wrangler config |
| Exa MCP (`web_fetch_exa`) | Not run (search sufficient) | — |
| Context7 MCP | Quota exceeded | — |
| Cloudflare docs MCP | 401 auth | — |
| `WebFetch` | OK | `dev.twitch.tv`, `developers.cloudflare.com` (D1, Vitest pool, adapter-cloudflare, wrangler config) |
| Repo | OK | `package.json`, `helix.ts`, `wrangler.jsonc`, tests |

---

## Toolchain pins {#toolchain-pins}

Runtime and test/deploy CLI versions (Vitest, Playwright, Wrangler). Product semantics: [24](./24-remediation-grounding-audit.md). Verify commands: [13](./13-testing-and-verification.md).

| Dependency | Repo pin | Official reference | Proof |
|------------|----------|-------------------|--------|
| **Bun** | `packageManager` in root `package.json` | [bun.sh](https://bun.sh) | `bun --version` |
| **SvelteKit + adapter-cloudflare** | `apps/web/package.json` | [SvelteKit](https://svelte.dev/docs/kit), [adapter](https://svelte.dev/docs/kit/adapters) | `bun run check:web`, `build:web` |
| **Wrangler** | `apps/web`, `workers/ingest` | [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `bun run dev:ingest`, deploy checklist [15](./15-ingest-runbook.md) |
| **Vitest** | ingest + web `~3.2` | [Vitest](https://vitest.dev) | `bun run test:ingest`, `test:web` |
| **@cloudflare/vitest-pool-workers** | `workers/ingest` | [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) | workers pool specs |
| **Playwright** | `apps/web` `@playwright/test` | [Playwright](https://playwright.dev/docs/intro) | `bun run test:e2e` — [13 § Playwright](./13-testing-and-verification.md#playwright-e2e-rem-035) |

| Check | Status | Command |
|-------|--------|---------|
| Lockfile committed | OPERATIONAL | `test -f bun.lock` |
| Web + ingest install | OPERATIONAL | `bun install --frozen-lockfile` (CI) |
| E2E browser | OPERATIONAL | `cd apps/web && bunx playwright install chromium` (first run) |

Before Kick: re-run [doc 24 matrix](./24-remediation-grounding-audit.md#twitch-phase-02-operational-matrix) and confirm no unpinned breaking upgrades land without updating this section.

---

## Zero-WARN policy

Aligned with [doc 24 § Zero-WARN](./24-remediation-grounding-audit.md#zero-warn-policy-twitch-freeze): every **NEEDS_REVIEW** row below must have a **fix** or **test proof** before treating grounding as complete.

| Status | Meaning |
|--------|---------|
| **PASS** | Version + official doc URL + repo usage verified |
| **NEEDS_REVIEW** | Version skew, nested transitive dep, or ops-only proof pending |

---

## Twitch ingest: Helix direct (not Twurple)

**Verdict:** OmniCharts ingest Worker uses **Helix direct** (`fetch` + `Authorization` + `Client-Id`). **Twurple is not installed** in any workspace `package.json` (grep repo: only [21](./21-twitch-ingest-libraries.md) references it).

| Approach | In repo? | Rationale |
|----------|----------|-----------|
| **Helix direct** | Yes — `workers/ingest/src/twitch/helix.ts`, `auth.ts`, `eventsub/subscriptions-api.ts` | Workers-friendly, no Node-only Twurple stack ([ADR-002](./adr/0002-twitch-eventsub-vs-polling.md), [21](./21-twitch-ingest-libraries.md)) |
| **Twurple `@twurple/api` + `@twurple/auth`** | No (reference / future CLI) | [Twurple docs](https://twurple.js.org/docs/getting-data/api/calling-api.html), [API reference](https://twurple.js.org/reference/api/) — npm **8.0.3+** (Exa/npm, Jun 2026) |

---

## Dependency table (workspaces)

Versions: **declared** in `package.json`; **resolved** from `bun.lock` where different.

| Package | Declared | Resolved (lock) | Official doc URL | Used in (paths) | Grounding |
|---------|----------|-----------------|------------------|-----------------|-----------|
| `bun` (toolchain) | `1.3.14` (root `packageManager`) | — | https://bun.sh/docs | monorepo scripts | PASS |
| **Twitch Helix** (no npm pkg) | — | — | https://dev.twitch.tv/docs/api/reference | `workers/ingest/src/twitch/helix.ts`, `auth.ts`, `eventsub/subscriptions-api.ts` | PASS |
| **Twurple** (reference only) | — | — | https://twurple.js.org/ | Not in code; [21](./21-twitch-ingest-libraries.md) | PASS |
| `wrangler` | ingest `4.97.0`; web `4.97.0` | **4.97.0** (both workspaces) | https://developers.cloudflare.com/workers/wrangler/ | `workers/ingest/wrangler.jsonc`, `apps/web/wrangler.jsonc`, `bun run types:ingest` | PASS |
| `@cloudflare/workers-types` | (transitive) | **4.20260531.1** via `@sveltejs/adapter-cloudflare` | https://developers.cloudflare.com/workers/languages/typescript/ | `apps/web/worker-configuration.d.ts`, `workers/ingest/worker-configuration.d.ts` (`wrangler types`) | PASS |
| `@cloudflare/vitest-pool-workers` | `^0.12.4` | **0.12.21** | https://developers.cloudflare.com/workers/testing/vitest-integration/ | `workers/ingest/vitest.workers.config.mts`, pool tests | PASS — nested `wrangler@4.72.0` under pool is Miniflare-only; deploy CLI uses workspace wrangler 4.97. **Proof:** `bun run test:ingest` (2026-06-03 green); `cd workers/ingest && bunx wrangler --version` → 4.97.0 |
| `vitest` | `~3.2.0` | **3.2.4** | https://vitest.dev/guide/ | `workers/ingest/vitest.*.mts`, `apps/web` (node tests) | PASS |
| `@vitest/coverage-v8` | `~3.2.0` | **3.2.4** | https://vitest.dev/guide/coverage.html | ingest `test:coverage` | PASS |
| `typescript` | ingest `^5.5.2`; web `^6.0.2` | per workspace | https://www.typescriptlang.org/docs/ | all TS | PASS (split majors intentional) |
| `@types/node` | `^25.9.1` | lock | https://www.npmjs.com/package/@types/node | ingest tests | PASS |
| `@sveltejs/kit` | `^2.57.0` | **2.61.1** | https://svelte.dev/docs/kit | `apps/web/src/**` | PASS |
| `@sveltejs/adapter-cloudflare` | `^7.2.8` | **7.2.8** | https://svelte.dev/docs/kit/adapter-cloudflare | `apps/web/svelte.config.js`, `.svelte-kit/cloudflare` | PASS |
| `@sveltejs/vite-plugin-svelte` | `^7.0.0` | lock | https://github.com/sveltejs/vite-plugin-svelte | `apps/web/vite.config.ts` | PASS |
| `svelte` | `^5.55.2` | lock | https://svelte.dev/docs/svelte/overview | `apps/web` | PASS |
| `vite` | `^8.0.7` | lock | https://vite.dev/guide/ | `apps/web/vite.config.ts` | PASS |
| `tailwindcss` | `^4.3.0` | lock | https://tailwindcss.com/docs | `apps/web` | PASS |
| `@tailwindcss/vite` | `^4.3.0` | lock | https://tailwindcss.com/docs/installation/using-vite | `apps/web/vite.config.ts` | PASS |
| `svelte-check` | `^4.4.6` | lock | https://github.com/sveltejs/language-tools | `bun run check:web` | PASS |
| `@playwright/test` | `^1.58.0` | lock | https://playwright.dev/docs/intro | `apps/web/e2e/` | PASS |

Root `package.json` has **no runtime dependencies** — only workspace scripts.

---

## Twitch / Helix: endpoints vs Twurple vs reference

Implementation: `TwitchHelixClient` (`helix.ts`), app token (`auth.ts` → `POST https://id.twitch.tv/oauth2/token`), EventSub REST (`eventsub/subscriptions-api.ts`).

**Required headers (all Helix calls):** `Authorization: Bearer <app_token>`, `Client-Id: <TWITCH_CLIENT_ID>` — per [Authentication](https://dev.twitch.tv/docs/api/guide#authentication) and [Get Channel Followers](https://dev.twitch.tv/docs/api/reference#get-channel-followers).  
**Proof:** `workers/ingest/test/helix-followers.spec.ts`, `test/auth.spec.ts`, `test/twitch-credentials.spec.ts`.

| Helix endpoint (repo) | Method / query | Call sites | Twurple 8.x equivalent (reference) | Official reference |
|----------------------|----------------|------------|-----------------------------------|-------------------|
| `POST /oauth2/token` | `client_credentials` | `auth.ts` | `RefreshingAuthProvider` / client credentials flow — [@twurple/auth](https://twurple.js.org/reference/auth/) | https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow |
| `GET /helix/streams` | global page (`first`, `after`) | `sweep.ts`, `discover.ts` (via client) | `apiClient.streams.getStreams({ after })` | https://dev.twitch.tv/docs/api/reference#get-streams |
| `GET /helix/streams` | `game_id`, pagination | `game-pass.ts`, `discover.ts` | `apiClient.streams.getStreams({ gameId, after })` | same |
| `GET /helix/streams` | `user_id` × N (batch ≤100) | `poll.ts`, `reconcile.ts` | `apiClient.streams.getStreamsByUserIds(ids)` | same |
| `GET /helix/games/top` | `first` | `discover.ts` | `apiClient.games.getTopGames(first)` | https://dev.twitch.tv/docs/api/reference#get-top-games |
| `GET /helix/users` | `id` × N | `enrich-profiles.ts` | `apiClient.users.getUsersByIds(ids)` | https://dev.twitch.tv/docs/api/reference#get-users |
| `GET /helix/channels` | `broadcaster_id` × N | `enrich-profiles.ts` | `apiClient.channels.getChannelInfoByUserId` / batch channel APIs | https://dev.twitch.tv/docs/api/reference#get-channel-information |
| `GET /helix/channels/followers` | `broadcaster_id`; read **`total` only** | `helix.ts` → rollup / `follower-snapshots` | `apiClient.channels.getChannelFollowerCount(broadcasterId)` (or followers API) | https://dev.twitch.tv/docs/api/reference#get-channel-followers |
| `GET /helix/eventsub/subscriptions` | list / cursor | `eventsub/subscriptions-api.ts`, `sync.ts` | `@twurple/eventsub-http` or Helix EventSub helpers | https://dev.twitch.tv/docs/eventsub/manage-subscriptions/ |
| `POST /helix/eventsub/subscriptions` | create | `subscriptions-api.ts` | same | https://dev.twitch.tv/docs/api/reference#create-eventsub-subscription |
| `DELETE /helix/eventsub/subscriptions` | `id` | `subscriptions-api.ts` | same | https://dev.twitch.tv/docs/api/reference#delete-eventsub-subscription |

**Rate limits:** Repo uses `Ratelimit-Remaining` / `Ratelimit-Reset` ([Helix guide — rate limits](https://dev.twitch.tv/docs/api/guide#twitch-rate-limits)); budget from `helixSafePointsPerMinuteFromEnv` / `helixPhaseBudgetFromEnv` in `helix-budget.ts`. **Proof:** `test/helix-budget.spec.ts`.

**Pagination note:** Dynamic stream directory omissions — [Helix guide — pagination](https://dev.twitch.tv/docs/api/guide#pagination); mitigated by game-pass + coverage cycle ([ADR-006](./adr/0006-twitch-helix-pagination-drift.md)).

---

## Cloudflare: bindings vs docs

### Ingest Worker — `workers/ingest/wrangler.jsonc`

| Binding / feature | Config | Official doc | Code / proof |
|-----------------|--------|--------------|--------------|
| `DB` (D1) | `d1_databases` → `omnicharts` | https://developers.cloudflare.com/d1/ | `src/db/**`, migrations `../../migrations/d1` |
| `SAMPLES` (R2) | `r2_buckets` → `omnicharts-samples` | https://developers.cloudflare.com/r2/ | sample archival paths in ingest |
| `INGEST_QUEUE` | `queues.producers` + `consumers` + DLQ | https://developers.cloudflare.com/queues/configuration/configure-queues/ | `src/queue/**`, `test/cron-messages.spec.ts` |
| Cron triggers | `*/1`, `*/2`, `15 0 * * *`, `0 */6 * * *` | https://developers.cloudflare.com/workers/configuration/cron-triggers/ | `src/index.ts` `scheduled` |
| `nodejs_compat` | `compatibility_flags` | https://developers.cloudflare.com/workers/runtime-apis/nodejs/ | required for some deps |
| `env.production` | vars override | https://developers.cloudflare.com/workers/wrangler/environments/ | `test/wrangler-production-env.spec.ts` |
| Secrets | `TWITCH_*`, `ADMIN_API_KEY` (not in file) | https://developers.cloudflare.com/workers/configuration/secrets/ | [15-ingest-runbook](./15-ingest-runbook.md) |

### Web (Pages) — `apps/web/wrangler.jsonc`

| Binding | Config | Official doc | Code |
|---------|--------|--------------|------|
| `DB` (D1) | same database id, `preview_database_id: "DB"` | https://developers.cloudflare.com/d1/binding-pages/ | `apps/web/src/lib/server/**` |
| `TWITCH_MIN_VIEWERS`, `TWITCH_RANKING_MIN_AIRTIME_MINUTES` | root dev + `env.production.vars` | [wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/) | `ranking-env.ts`, `platform.env` |
| `nodejs_als` | `compatibility_flags` | [adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare) | SvelteKit platform |
| Output | `pages_build_output_dir: ".svelte-kit/cloudflare"` | https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/ | `bun run build:web` |

**Wrangler configuration reference:** https://developers.cloudflare.com/workers/wrangler/configuration/

---

## Web stack

| Piece | Version (lock) | Doc | Repo |
|-------|----------------|-----|------|
| SvelteKit 2 | 2.61.1 | https://svelte.dev/docs/kit | routes, `+page.server.ts`, loaders |
| adapter-cloudflare 7 | 7.2.8 | https://svelte.dev/docs/kit/adapter-cloudflare | `svelte.config.js`, `platform.env.DB` |
| Vitest (web) | 3.2.4 | https://vitest.dev/ | `apps/web/src/lib/server/*.test.ts` (Node env) |
| Vitest (ingest unit) | 3.2.4 | https://vitest.dev/ | `vitest.unit.config.mts` — 80% coverage thresholds on `src/twitch`, `src/db` |
| Vitest Workers pool | 0.12.21 | https://developers.cloudflare.com/workers/testing/vitest-integration/ | `vitest.workers.config.mts` — `index`, `twitch`, `eventsub-verify` specs |
| Playwright | lock | https://playwright.dev/docs/test-webserver | `e2e/smoke.spec.ts`, [13](./13-testing-and-verification.md) |

**Local preview:** `wrangler pages dev .svelte-kit/cloudflare` ([adapter-cloudflare — Testing locally](https://svelte.dev/docs/kit/adapter-cloudflare#Testing_locally)).

---

## NEEDS_REVIEW closure checklist

| Item | Fix or proof |
|------|----------------|
| ~~Web `wrangler` semver `^4.81.0` vs ingest `4.97.0`~~ | **Closed** — web pinned `4.97.0`; proof: `bun run check:web`, `bun run test:web` |
| `@cloudflare/vitest-pool-workers` → nested wrangler 4.72 | Accept for Miniflare pool only; ingest deploy uses workspace wrangler 4.97 — **Closed:** `bun run test:ingest` passes (unit + workers projects); `bunx wrangler --version` in `workers/ingest` → 4.97.0 |
| EventSub prod callback | **NEEDS_PROOF** in [24 matrix](./24-remediation-grounding-audit.md#twitch-phase-02-operational-matrix) — not a wrong library choice |

No Helix header or follower-endpoint misuse found in this pass; **no code changes** required.

---

## Verification commands

See [13-testing-and-verification.md](./13-testing-and-verification.md) (SSOT). Quick: `bun run test:ingest`, `bun run verify:twitch` (full gate when ingest dev up), `bun run check:web`.

---

## References (top official URLs added in this doc)

1. https://dev.twitch.tv/docs/api/reference — Helix reference (source of truth)
2. https://dev.twitch.tv/docs/api/guide — auth, rate limits, pagination
3. https://twurple.js.org/docs/getting-data/api/calling-api.html — Twurple reference implementation (not in Worker)
4. https://developers.cloudflare.com/workers/testing/vitest-integration/ — Workers Vitest pool
5. https://developers.cloudflare.com/queues/configuration/configure-queues/ — queue producer/consumer wrangler schema

See also [24 § References](./24-remediation-grounding-audit.md#references-official-urls) for D1 limits, cron, secrets.
