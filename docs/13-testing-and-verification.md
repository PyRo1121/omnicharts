# Testing and verification

---

## Test pyramid

| Layer | What | When |
|-------|------|------|
| Unit | Rollup math (HW, AV), tie-break sort | Every commit |
| Integration | Ingest fixture → samples → rollup row | PR |
| Smoke | Homepage 200, rankings non-empty | Deploy |
| Competitive | Top-N overlap vs public sites | Weekly manual / CI optional |

---

## Golden rollup fixtures

Store under `tests/fixtures/`:

| Fixture | Asserts |
|---------|---------|
| `samples_linear.json` | Constant 100 viewers × 60 min → HW = 100 |
| `samples_ramp.json` | Known integral |
| `multi_stream_day.json` | Two sessions same channel sum correctly |

Formula source: [04-metrics-glossary.md](./04-metrics-glossary.md).

---

## Ranking tests

```ts
// Pseudocode expectations
sortByHoursWatchedDesc(channels);
// tie: higher average_viewers wins
// tie: lexicographic slug asc
```

Period: **rolling 7×24h UTC** ending at last completed rollup day (document in UI).

---

## Ingest integration test (local)

1. Mock Helix `streams` response (JSON file).
2. Run `poll_channel_batch` handler against SQLite.
3. Assert `viewer_samples` count and one `channel_daily_rollup` after `rollup_daily`.

---

## Coverage gates (Phase 1 Twitch ingest)

| Gate | Command |
|------|---------|
| Ingest unit + workers | `bun run test:ingest` |
| Twitch + DB coverage ≥ 80% | `bun run test:ingest:coverage` |
| Web server load helpers | `bun run test:web` |
| Ingest + web unit (CI fast path) | `bun run test` |
| Full Twitch smoke | `bun run verify:twitch` |

**Coverage scope** (`workers/ingest`, unit project): `src/twitch/**/*.ts` (except `index.ts` if present) and `src/db/**/*.ts`, thresholds 80% lines/branches/functions/statements per glob.

**Web tests** (`apps/web`): Vitest in `src/lib/server/*.test.ts` — mocked `fetch` against ingest JSON for `loadTwitchChannelRankings`, `loadChannelDetail`, `loadGameDetail`, `loadOverview`, `loadTwitchGameRankings`.

### Verify scripts (SSOT)

Root `package.json` scripts — **do not duplicate bash blocks** in docs 23/24/26; link here instead.

| Script | When | Requires |
|--------|------|----------|
| `bun run test` | Fast unit gate (ingest + web) | — |
| `bun run verify:twitch` | Full Twitch gate before claiming ingest/web work done; freeze **G1** | Local: `dev:ingest` for checkpoint; CI: `VERIFY_SKIP_CHECKPOINT=1` unless `VERIFY_FULL=1` |
| `bun run twitch:freeze-proof` | M1 operational proof matrix (health → schema → cron → checkpoint → optional EventSub) | `dev:ingest` with `--test-scheduled` |
| `bun run twitch:checkpoint --no-start-ingest` | Deep ingest pipeline smoke (subset of verify) | `dev:ingest` + `ADMIN_API_KEY` in `.dev.vars` |
| `bun run twitch:checkpoint:full` | Slow coverage poll path | Same as checkpoint |
| `bun run d1:verify-schema` | After `d1:migrate:local` — tables/columns/indexes through migration **0008** | Local D1 |
| `bun run d1:verify-schema:remote` | Pre-deploy / freeze **G2** — parity through **0008** | Wrangler login |
| `bun run verify:wrangler-production` | Pre-deploy guard: prod vars 60m airtime / 20 min viewers | — |
| `bun run check:web` | Wrangler types + svelte-check | — |
| `bun run build:web` | Production Pages build | — |

Implementation: `scripts/verify/twitch-e2e-verify.ts` (`verify:twitch` and `twitch:freeze-proof` share one script; `--proof-matrix` selects M1 path). All verify scripts: [`scripts/verify/`](../scripts/verify/) · [`scripts/README.md`](../scripts/README.md).

### `verify:twitch` (agents)

From repo root (ingest must be running for checkpoint: `bun run dev:ingest`):

1. `bun run test:ingest` — ingest Vitest
2. `bun run test:ingest:coverage` — Twitch + `src/db/` ≥80%
3. `bun run test:web` — server load mocks
4. Fail fast if `GET http://127.0.0.1:8787/health` unreachable (skipped when `VERIFY_SKIP_CHECKPOINT=1` or `CI=true` without `VERIFY_FULL=1`)
5. `bun run twitch:checkpoint --no-start-ingest`
6. `bun run check:web` — `svelte-check`
7. `bun run build:web`

**CI (`.github/workflows/verify-twitch.yml`, REM-030):** runs ingest unit tests, web tests, `check:web`, `build:web`, OpenAPI lint (`npx @redocly/cli lint openapi/v1.yaml --config openapi/redocly.yaml`), and `verify:twitch` with `VERIFY_SKIP_CHECKPOINT=1` (and `CI=true`) so the **checkpoint is skipped** — no Helix secrets or wrangler ingest on PRs. **Playwright smoke (REM-035):** same workflow, `continue-on-error: true` after `bun run test:e2e` (Chromium installed in prior step). Channel test skips when ingest is down.

**Optional full gate in CI (`VERIFY_FULL=1`):** Unset `VERIFY_SKIP_CHECKPOINT`, set `VERIFY_FULL=1`, and provide Twitch + admin secrets — then step 5 runs `twitch:checkpoint --no-start-ingest` like local dev.

1. Add repo secrets: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `ADMIN_API_KEY` (same name as `workers/ingest/.dev.vars`).
2. In the workflow job: `bun run dev:ingest` (background), wait for `GET http://127.0.0.1:8787/health`, then `VERIFY_FULL=1 bun run verify:twitch`.
3. Checkpoint uses `Authorization: Bearer` / `X-Admin-Api-Key` from `ADMIN_API_KEY` ([`scripts/verify/twitch-phase1-checkpoint.ts`](../scripts/verify/twitch-phase1-checkpoint.ts)).

| Env | Effect |
|-----|--------|
| `VERIFY_SKIP_CHECKPOINT=1` | Skip checkpoint (unit + web + build only) |
| `CI=true` without `VERIFY_FULL=1` | Same as skip (default in GitHub Actions) |
| `VERIFY_FULL=1` | Run `twitch:checkpoint --no-start-ingest` when ingest is reachable |

### Playwright E2E (REM-035)

| Command | What |
|---------|------|
| `bun run test:e2e` | From repo root — builds web, `wrangler pages dev` on port 4173, runs `apps/web/e2e/smoke.spec.ts` |
| `bun run --filter web test:e2e:ui` | Playwright UI mode |

**Prerequisites:** `bun install` (installs `@playwright/test`); first run: `cd apps/web && bunx playwright install chromium`.

**With live channel smoke:** start ingest (`bun run dev:ingest`), optionally `bun run twitch:checkpoint`, then `INGEST_URL=http://127.0.0.1:8787 bun run test:e2e`. Channel test is skipped when ingest is down or rankings empty.

**SvelteKit practice (2025–2026, Exa):** use `webServer` with production `build` + `preview` (here: Cloudflare `wrangler pages dev`), `baseURL` on preview port, role/text locators (`getByRole`, `#channel-search`), `reuseExistingServer` locally; avoid testing third-party sites; keep CI workers at 1 when sharing one preview server.

Pre–Kick freeze: [23 §2](./23-audit-remediation-plan.md#2-freeze-gate-twitch-frozen--kick-may-start) and [24 operational matrix](./24-remediation-grounding-audit.md#twitch-phase-02-operational-matrix).

| Gate | Command |
|------|---------|
| Full Twitch smoke | `bun run verify:twitch` |
| M1 proof matrix | `bun run twitch:freeze-proof` |
| D1 schema (local) | `bun run d1:verify-schema` (after `d1:migrate:local`) — migrations **0001–0008** |
| D1 schema (pre-deploy) | `bun run d1:verify-schema:remote` — freeze G2; indexes **0007–0008** |
| Production wrangler vars | `bun run verify:wrangler-production` — freeze G3 guard |
| Types | `bun run check:web` |
| Build | `bun run build:web` |

### Lighthouse smoke

Audits production build on preview port 4173. Budgets and lane summary: [audits/web-performance.md](./audits/web-performance.md).

| Script | When |
|--------|------|
| `bun run lighthouse:smoke` | After `build:web`; optional autoresearch loop may call it |
| Env overrides | `LH_MIN_PERFORMANCE`, `LH_MIN_ACCESSIBILITY`, `LH_MIN_BEST_PRACTICES`, `LH_MIN_SEO`, `LIGHTHOUSE_URL`, `CHROME_PATH` |

Artifacts (gitignored): `./autoresearch-results/lighthouse-*.json` — see [AGENTS.md](../AGENTS.md#autoresearch).

---

## Verification before claiming “MVP done”

- [ ] Parity matrix H1–H5 + channel + game for Twitch ([01](./01-competitive-parity-matrix.md))
- [ ] Methodology page live
- [ ] `tracked_since` on channel pages
- [ ] Ingest coverage ≥ 95% on seed list ([14](./14-observability-slos-and-error-budgets.md))
- [ ] No paywall on 30d toggle

---

## Playwright backlog (post–REM-035)

- Platform tab switches in E2E
- Snapshot critical tables (structure, not pixel-perfect)
- Optional `hydrated` attribute wait (SvelteKit hydration flake guard)
