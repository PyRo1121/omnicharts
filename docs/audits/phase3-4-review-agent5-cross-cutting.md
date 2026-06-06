# Phase 3–4 cross-cutting audit — Agent 5

**Date:** 2026-06-05  
**Scope:** Shared infrastructure between Phase 3 (multi-platform MVP) and Phase 4 (retention & agency) — `json-guards`, `api-errors` SSOT, verify scripts, test harness, oxlint enterprise config, signoff doc parity.  
**Related:** [phase3-signoff](./phase3-signoff.md) · [phase4-signoff](./phase4-signoff.md) · [13-testing-and-verification](../13-testing-and-verification.md) · [19-project-scaffold-and-commands](../19-project-scaffold-and-commands.md#lint-philosophy-oxlint) · commit `3d51d4f` (oxlint + json-guards + test harness)

---

## Executive summary

| Severity | Count |
|----------|-------|
| **P0** | 0 |
| **P1** | 2 |
| **P2** | 7 |

Cross-cutting infra is **sound for Phase 5 kickoff**. `parseHelixVideo` loosening is **correct** (fixes over-strict parser that dropped Helix rows tests already send). Main gaps: **verify gate wiring** (`verify:wrangler-production` not in `verify:twitch`), **stale success strings** in freeze proof matrix, **GitNexus index stale** for `parseHelixVideo` impact tracing.

**Local gates run this audit:** `bun run lint` — **PASS** (oxlint, zero issues). `bun run verify:wrangler-production` — **PASS** (60m airtime, 20 min viewers).

---

## Research tooling

| Tool | Query / action | Result |
|------|----------------|--------|
| **GitNexus** `detect_changes` (compare → `main`) | `json-guards.ts` | No uncommitted drift vs `main`; risk `none` |
| **GitNexus** `query` | `"parseHelixVideo"` | Empty processes/symbols — **index stale** for this symbol |
| **GitNexus** `impact` upstream | `parseHelixVideo` @ `workers/ingest/src/json-guards.ts` | `Target not found` — same staleness |
| **Context7** | Vitest + oxlint typeAware | Quota exceeded — skipped; oxlint behavior verified via doc 19 + local `bun run lint` |
| **Exa** | JSON boundary validation patterns | Manual type guards at boundaries are standard for zero-dep Workers; schema libs (Zod) recommended when shapes grow — see [Exa grounding](#exa-json-boundary-patterns) |
| **Twitch Helix** | [Get Videos](https://dev.twitch.tv/docs/api/reference#get-videos) | Response fields documented; see [json-guards verdict](#json-guards-verdict-parsehelixvideo) |

**GitNexus action:** run `npx gitnexus analyze` before relying on impact/query for parser edits.

---

## json-guards verdict (`parseHelixVideo`)

### What changed (commit `3d51d4f`)

**Before (too strict):** `requireString` on every Helix video field (`user_login`, `title`, `published_at`, `duration`, `language`, …). Any missing or non-string field → `null` (row dropped).

**After (boundary-correct):**

- **Required:** `id`, `user_id`, `type` only.
- **Optional strings:** `optionalString()` → `readString(...) ?? ''` for display/metadata fields.
- **Numeric:** `view_count` defaults to `0` when absent.

### Twitch API grounding

Per [Twitch Get Videos — Response Body](https://dev.twitch.tv/docs/api/reference#get-videos), a successful `GET /helix/videos` returns objects with:

| Field | Type (Twitch docs) |
|-------|-------------------|
| `id` | String |
| `user_id` | String |
| `user_login` | String |
| `user_name` | String |
| `title` | String |
| `description` | String |
| `created_at` | String (RFC3339) |
| `published_at` | String (RFC3339) |
| `url` | String |
| `thumbnail_url` | String |
| `viewable` | String (always `public`) |
| `view_count` | Integer |
| `language` | String |
| `type` | String (`archive` \| `highlight` \| `upload`) |
| `duration` | String (ISO 8601 duration) |

Twitch documents the **full shape** for normal 200 responses; the reference table does not mark individual response fields with a separate “Required?” column (unlike request query params). In practice:

1. **`helix-videos.spec.ts`** already mocks minimal payloads `{ id, user_id, type: 'archive' }` — the old parser returned **zero videos** from real integration tests.
2. **Downstream safety:** `filterVideosForChannel` uses `published_at || created_at`; empty strings fail `Date.parse` → excluded from retention window (`isVideoWithinRetention` returns false). `vodSessionTimes` tolerates empty `duration` (`ended_at: null`). No silent corrupt upserts.

### Verdict

| Question | Answer |
|----------|--------|
| Too loose? | **No** for ingest boundary — identity fields gated; empty metadata degrades gracefully |
| Too strict before? | **Yes** — rejected valid Helix rows used in tests and plausible partial API payloads |
| Match Twitch docs? | **Aligned** — Twitch always documents full objects; parser accepts full or minimal superset; stricter “all strings required” was **stricter than documented contract** and broke tests |

**Recommendation (P2):** add `workers/ingest/test/json-guards-helix-video.spec.ts` with cases: minimal `{ id, user_id, type }`, full Twitch example object, missing `published_at` (expect parse OK, retention filter drops).

### Other Helix/EventSub parsers (spot-check)

| Parser | Pattern | Notes |
|--------|---------|-------|
| `parseHelixStream` / `parseHelixUser` | Strict `requireString` on core fields | OK — live poll paths need complete rows |
| `parseHelixVideo` | Loose metadata, strict identity | OK — VOD backfill Phase 4.6 |
| `parseEventSubWebhookBody` | Empty-string fallbacks for `id`/`type`/`status` | Acceptable for webhook challenge/revocation envelopes; `parseStreamOnlineEvent` stays strict |

### Coverage gap

`workers/ingest/src/json-guards.ts` sits at **`src/json-guards.ts`** — **outside** vitest coverage globs (`src/twitch/`, `src/db/`, …). Parser logic is exercised indirectly via `helix-videos.spec.ts` and poll specs, but **line coverage of guard helpers is ungated** (P2).

---

## `api-errors` SSOT (`packages/rollup/src/api-errors.ts`)

| Check | Status |
|-------|--------|
| Single envelope `{ error: { code, message } }` | OK — matches OpenAPI `Error` schema |
| Ingest + Pages BFF import from `@omnicharts/rollup` | OK — `workers/ingest/src/index.ts`, `apps/web/src/routes/api/v1/**` |
| Message maps per route family | OK — rankings channels/games, search, compare, channel detail |
| Unit tests | Partial — `packages/rollup/test/api-errors.test.ts` covers rankings/search/compare; **`channelDetailQueryErrorResponse` untested** (P2) |
| OpenAPI error code parity | Descriptions reference behaviors (e.g. `invalid_language`); codes live in TS SSOT, not duplicated as enum in `openapi/v1.yaml` — intentional per Phase 4 pattern |

No P0/P1 on api-errors.

---

## Verify scripts & gate gaps

SSOT: [13-testing-and-verification.md](../13-testing-and-verification.md) · implementation under `scripts/verify/`.

### `verify:wrangler-production`

**Command:** `bun run verify:wrangler-production` → `scripts/verify/verify-wrangler-production-env.ts`

**Checks:** parses `workers/ingest/wrangler.jsonc` `env.production.vars`:

| Var | Expected |
|-----|----------|
| `ENVIRONMENT` | `production` |
| `TWITCH_RANKING_MIN_AIRTIME_MINUTES` | `60` |
| `TWITCH_MIN_VIEWERS` | `20` |

**Audit run:** PASS.

**Gap (P1):** Not a step in `verify:twitch` (9-step gate). Only referenced in `scripts/verify/autoresearch-phases02-verify.ts` (G3) and [phase5-execution-plan](./phase5-execution-plan.md) P6. Pre-deploy agents can miss G3 if they run only `verify:twitch`.

### `check-ingest-coverage-thresholds.ts`

Post-vitest gate enforcing **≥80%** on `src/twitch/`, `src/db/`, `src/kick/`, `src/youtube/`, `src/r2/`, `src/watchlist/` — compensates for vitest 3.2.x per-glob threshold unreliability. **PASS** when signoffs were written. Does not include `src/json-guards.ts` (P2).

### `verify:twitch` vs `twitch:freeze-proof`

| Gate | Includes |
|------|----------|
| `verify:twitch` | test:ingest, test:ingest:coverage, test:web, lint, format:check, checkpoint (optional), check:web, build:web |
| `twitch:freeze-proof` | health, d1:verify-schema, ingest:cron, checkpoint, optional EventSub proof |

**Gap (P1):** `twitch-e2e-verify.ts` proof-matrix success string still says **`migrations 0001–0009`** while `verify-d1-schema.ts` validates through **`0010_twitch_vod_metadata`** (Phase 4 VOD columns). Script passes; **misleading operator output**.

**Gap (P2):** `verify:twitch` never runs `d1:verify-schema` or `verify:wrangler-production` — documented separately in doc 13 but easy to skip.

### Phase 3/4 signoff vs reality

| Signoff claim | Reality |
|---------------|---------|
| Phase 3 `verify:twitch` **6/6** | Current script logs **9 steps** — doc stale (P2) |
| Phase 4 lists lint/test gates only | Omits `verify:wrangler-production`, E2E, platform verifies — acceptable deferrals but incomplete for Phase 5 handoff (P2) |
| Phase 3 G3 prod thresholds | Code + `verify:wrangler-production` ready; prod deploy still deferred per signoff — **consistent** |

---

## Test harness (`helpers.ts`, `mock-d1.ts`)

| Asset | Assessment |
|-------|------------|
| `mockIngestD1` | Minimal D1 double with prepare/batch/session — fail-fast on unexpected SQL |
| `testEnv()` / `TEST_ENV_*` partials | Typed `satisfies Env`; clears creds for NEEDS_API paths |
| `testEnvProductionDefaults()` | Strips wrangler numeric overrides for parser-default tests — good for config grounding |
| `pollBatchD1` / `healthStatusD1` | Targeted stubs for poll + health batch shapes |

Aligned with oxlint enterprise push (commit `3d51d4f`): helpers removed unsafe casts that triggered `typescript/no-unsafe-*` in tests.

---

## Oxlint enterprise config (`.oxlintrc.json`)

| Area | Config | Impact |
|------|--------|--------|
| Core | `typeAware: true`, correctness + suspicious errors | Caught floating promises, misused async in prod |
| Prod paths | `no-explicit-any` error; `no-unsafe-*` warn | Drives json-guards over `as` casts |
| Tests (`*.spec.ts`, `test/**`) | Relaxed unsafe propagation; **strict** on `no-unsafe-type-assertion`, `no-base-to-string`, `unbound-method` | Tests must use typed mocks |
| Scripts | `no-console` off; stricter template/base-to-string | Verify CLIs use `scripts/lib/json-guards.ts` |
| Documented noise | doc 19 lint philosophy table | Intentional disables (`no-await-in-loop`, Svelte imports) |

**Audit:** `bun run lint` — **PASS**, zero diagnostics across `apps/web`, `packages`, `workers/ingest`, `scripts`.

**P2:** `typescript/no-unsafe-*` remain **warn** in prod — acceptable per doc 19; json-guards pattern is the approved fix path.

---

## Exa: JSON boundary patterns

Industry consensus (Exa: [Type guards vs schema validation](https://stevekinney.com/courses/full-stack-typescript/type-guards-vs-schema-validation), [safe JSON parsing](https://jsonic.io/guides/json-parse-safe-typescript)):

- Treat `JSON.parse` / `fetch().json()` as **`unknown`**; never `as T`.
- Hand-rolled guards: zero bundle cost, fits Workers ingest — **current approach**.
- Zod/Valibot: better when shapes proliferate or OpenAPI codegen sync is needed — **not required yet** for Helix subset.

OmniCharts correctly uses **manual guards at platform boundaries** + **OpenAPI-shaped errors at HTTP boundaries**.

---

## Findings register

### P0 — none

### P1 — must fix before Phase 5 prod deploy

| ID | Finding | Fix |
|----|---------|-----|
| P1-01 | `verify:twitch` omits `verify:wrangler-production` (freeze G3) | Add step after lint or document mandatory dual run in Phase 5 P6 checklist; prefer adding to `twitch-e2e-verify.ts` |
| P1-02 | Freeze proof matrix logs `0001–0009` after migration **0010** shipped | Update `scripts/verify/twitch-e2e-verify.ts` line ~186 to `0001–0010` |

### P2 — should fix when touching area

| ID | Finding | Fix |
|----|---------|-----|
| P2-01 | GitNexus index missing `parseHelixVideo` | `npx gitnexus analyze` |
| P2-02 | No dedicated `parseHelixVideo` unit tests | `test/json-guards-helix-video.spec.ts` |
| P2-03 | `json-guards.ts` outside coverage globs | Add `src/json-guards.ts` to gate or accept as shared infra with indirect coverage |
| P2-04 | `channelDetailQueryErrorResponse` untested | One test in `api-errors.test.ts` |
| P2-05 | Phase 3 signoff `6/6` vs 9 verify steps | Update signoff table |
| P2-06 | Three `json-guards.ts` copies (ingest / web / scripts) | Document ownership; dedupe only if drift appears |
| P2-07 | `verify:twitch` does not run `d1:verify-schema` | Optional step or Phase 5 pre-deploy doc cross-link |

---

## Citation policy going forward

All code changes that touch **external contracts** (platform APIs, Cloudflare, CLI, OpenAPI) must follow this three-bullet standard (extends [20-documentation-standards.md](../20-documentation-standards.md)):

1. **Primary source link** — cite the official doc URL in the PR/commit body or adjacent code comment when behavior is non-obvious (e.g. Helix field optionality: [Get Videos response](https://dev.twitch.tv/docs/api/reference#get-videos)). No scraped third-party API mirrors as sole authority.

2. **Doc 19 correction log** — any new or changed root script (`package.json`, verify CLI) gets a dated row in [19 § Correction log](../19-project-scaffold-and-commands.md#correction-log) with the official CLI/doc citation.

3. **Test or verify grounding** — parser/guard changes must include or extend a test fixture that matches the cited contract (minimal + full example); verify script success strings must match current migration/schema head (currently **0010**).

---

## What was done well

- Enterprise oxlint drove **real fixes** (json-guards, test env) instead of rule disables — matches doc 19 agent policy.
- `api-errors` SSOT eliminated duplicate BFF/ingest error envelopes (Phase 2–4 wave 2 confirmed).
- `check-ingest-coverage-thresholds.ts` pragmatic workaround for vitest per-glob thresholds.
- `parseHelixVideo` loosening unblocks VOD backfill tests and matches how Helix client already filters null parses.
- `verify:wrangler-production` is small, deterministic, and **passes** on current `wrangler.jsonc`.

---

## Exit

**Agent 5 complete.** Cross-cutting Phase 3–4 infra is **merge-ready** with **2 P1** verify/doc wiring items before production deploy. No blockers for continued Phase 5 implementation work.
