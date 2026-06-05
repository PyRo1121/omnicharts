# OmniCharts Roadmap

Living plan aligned with [docs/00-vision-and-principles.md](./docs/00-vision-and-principles.md). Update checkboxes as phases ship.

**Phase 0–3 (MVP):** Shipped (2026-06-05) — three-platform discovery loop. **Phase 4** in progress — [28-phase4-plan](./docs/28-phase4-plan.md).

## MVP definition (canonical)

**MVP complete = Phase 3 exit:** Streams Charts–style **discovery loop** for **Twitch + Kick + YouTube**:

- Homepage H1–H5 + overview strip + methodology ([parity matrix](./docs/01-competitive-parity-matrix.md))
- **Channel + game pages** (not homepage-only)
- 7d and **30d** period toggles on rankings
- 30-day retention in queries

Phase 2 = Twitch-only slice of the same loop. See [02-user-personas](./docs/02-user-personas-and-journeys.md).

---

## Phase 0 — Source of truth

- [x] Product decisions captured
- [x] Core documentation tree + deep-dive (Cloudflare, ingest, ADRs)
- [x] P1 docs: search ([16](./docs/16-search-and-resolution.md)), methodology ([17](./docs/17-methodology-page.md)), legal ([18](./docs/18-legal-and-compliance-checklist.md)), [OpenAPI](../openapi/v1.yaml)
- [x] Scaffold guide ([19](./docs/19-project-scaffold-and-commands.md)); Kick + YouTube ingest deep-dive in [05](./docs/05-ingestion-per-platform.md)
- [ ] `git commit` when ready
- [ ] Donation URL + legal emails (replace placeholders)

**Exit criteria:** Implementer can build without re-reading Streams Charts. **Met** — proceed to Phase 1.

---

## Phase 1 — Foundation (weeks 1–3)

**Goal:** Prove ingest + one ranking table end-to-end.

- [x] **Scaffold via CLI** — run [doc 19](./docs/19-project-scaffold-and-commands.md) Steps 0–3 (cited; audited 2026-06-01)
  - [x] Step 0: root workspaces (Bun)
  - [x] Step 1: `bunx sv create web` + `sveltekit-adapter=adapter:cloudflare+cfTarget:pages` — [Creating a project](https://svelte.dev/docs/kit/creating-a-project) · [sveltekit-adapter](https://svelte.dev/docs/cli/sveltekit-adapter)
  - [x] Step 1c: `cd apps/web && bun run dev` (localhost:5173)
  - [x] Step 2: ingest Worker (C3) + queues + `wrangler.jsonc` bindings — [doc 19 Step 2](./docs/19-project-scaffold-and-commands.md#step-2--ingest-worker-workersingest)
  - [x] Step 3: D1 `omnicharts` + `0001_init_schema.sql` applied local + remote — [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [x] Implement schema in `migrations/d1/` from [06-storage](./docs/06-storage-and-rollup-design.md) (`0001`–`0003`)
- [x] Twitch: Helix poll + discovery ([doc 21](./docs/21-twitch-ingest-libraries.md), `workers/ingest/src/twitch/`)
- [x] Twitch: EventSub webhook (HMAC verify + stream.online/offline + subscription sync)
- [x] Discovery seed ([12-channel-discovery](./docs/12-channel-discovery-and-tracking.md)) — `POST /admin/twitch/discover` + `discovery_seed_at` metadata
- [x] Daily rollups + unit tests ([13-testing](./docs/13-testing-and-verification.md))
- [x] Search index (slug, display_name) — prefix LIKE + indexes ([16-search](./docs/16-search-and-resolution.md); FTS5 deferred)
- [x] Dev ingest health view (`/dev/ingest`, ingest `GET /health`)
- [x] D1 migrations `0002`–`0008` (EventSub, metadata/search, Helix stream + profile, sightings + followers, hot-path indexes)
- [x] Channel state machine: dormant (30d), retired (enrich), `slug_history`
- [x] `GET /v1/rankings/games` (Twitch; `game_daily_rollups`)
- [x] `GET /v1/channels/{slug}` (rollups + profile; web proxy at `/api/v1/channels/[slug]`)
- [x] Follower total via Helix `GET /channels/followers` (app token, `total` only)
- [x] Promotion: ≥2 live sightings in 14d; reconcile retires missing Helix users
- [x] Health ops: `channels_live`, `discovery_new_24h`, `ingest_lag_seconds.twitch`

**Exit criteria:** Local top 20 Twitch channels by HW (7d) — `bun run dev:seed-rankings` then `bun run twitch:rankings` or `/channels` with ingest running. Game rankings: `GET /v1/rankings/games?platform=twitch&period=7d`.

---

## Phase 2 — Discovery MVP, Twitch (weeks 4–6)

**Goal:** Full Streams Charts loop for **Twitch only**.

- [x] Add routes in scaffolded `apps/web/src/routes/` ([09-ui](./docs/09-ui-routes-and-components.md)) — SvelteKit file-based routing
- [x] `/` — hero (honest scale copy), platform tab, search, top streamers/games, **7d + 30d** toggle
- [x] `/channels/[slug]`, `/games/[slug]`, `/overview` (minimal cards)
- [x] `/methodology` + footer link; `tracked_since` on channels
- [x] Donation/support placeholder (`/support`, footer + homepage banner)
- [x] Optional: live-now strip on homepage ([01-parity](./docs/01-competitive-parity-matrix.md) H7b partial — count + link; top-5 deferred)
- [x] `/search?q=` results page

**Exit criteria:** Parity matrix Twitch rows H1–H5, H7a, H8a, H8b + channel + game pages.

---

## Phase 3 — Multi-platform (weeks 7–10) — **shipped 2026-06-05**

**Sign-off:** [docs/audits/phase3-signoff.md](./docs/audits/phase3-signoff.md) · freeze [26](./docs/26-twitch-freeze-execution-plan.md) G1–G12 signed with documented ops deferrals.

- [x] Kick: official API ([ADR-003](./docs/adr/0003-kick-ingest-strategy.md)) — discover, poll, webhook
- [x] YouTube: tracked UC poll + seed per [05-ingestion](./docs/05-ingestion-per-platform.md)
- [x] Platform tabs + `?platform=` on URLs (homepage, directories, overview, search)
- [x] Three-platform browse: homepage H1–H5, channel + game pages, methodology, 7d/30d

**Exit criteria:** **MVP complete** — three-platform homepage loop, 30d data. **Met.**

---

## Phase 4 — Retention & agency (weeks 11–14)

Plan: [28-phase4-plan](./docs/28-phase4-plan.md)

- [x] **CSV export** on channel rankings + channel detail (`format=csv` API + UI links) — slice 4.1 shipped 2026-06-05
- [x] 90-day rollups (Phase 4 slice 4.2)
- [x] R2 Parquet cold path (Phase 4 slice 4.3)
- [ ] Twitch VOD metadata backfill (tier-limited)
- [x] **2-channel compare** (7d/30d/90d) — `/compare` + API (slice 4.4 shipped 2026-06-05)
- [x] **Agency CSV watchlist import** — `POST /admin/watchlist/import` (slice 4.5 shipped 2026-06-05)
- [ ] Language filter on rankings when API provides tags

---

## Phase 5 — Cloudflare production (weeks 15–18)

- [ ] Pages + ingest Worker on **Workers Paid** for ingest ([ADR-004](./docs/adr/0004-cloudflare-free-vs-paid.md))
- [ ] D1, R2, Queues, Cron per [11](./docs/11-cloudflare-deployment.md)
- [ ] `/health`, SLOs ([14-observability](./docs/14-observability-slos-and-error-budgets.md))
- [ ] Public beta + custom domain

**Exit criteria:** Public beta; ingest lag p95 &lt; 5 min.

---

## Phase 6 — API & tools (weeks 19+)

- [ ] Public REST API v1 ([07-api-spec](./docs/07-api-spec.md))
- [ ] API keys (free generous limits)
- [ ] 3-channel compare; tools hub (prioritize by Streams Charts `/tools` traffic)

---

## Phase 7 — Depth (ongoing)

- [ ] 365-day retention
- [ ] Chat analytics where ToS allows
- [ ] News/blog (low priority)
- [ ] Donations live
- [ ] Minimal paid tier only if infra requires ([08](./docs/08-auth-billing-entitlements.md))

---

## History depth milestones

| Milestone | Target |
|-----------|--------|
| M0 | Discovery loop shipped (Phase 3) |
| M1 | 30 days all platforms |
| M2 | 90 days |
| M3 | 365 days |
| M4 | Full depth since **first_observed_at** |
| M5 | VOD metadata backfill within platform limits |

---

## Explicitly later / maybe never

- 15 platforms, VTuber DB, sponsorship marketplace, enterprise sales
- Scraping Streams Charts or relicensing Jazz API
