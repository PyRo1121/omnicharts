# Phase 3–4 review — Agent 4: Web + Packages (Phase 4)

**Date:** 2026-06-05  
**Scope:** CSV export · compare · language filter · 90d UI · `@omnicharts/rollup` / `@omnicharts/domain` · OpenAPI vs Pages BFF  
**Plan:** [28-phase4-plan](../28-phase4-plan.md) slices 4.1, 4.2, 4.4, 4.7

**MCP tools invoked**

| MCP | Tool | Use |
|-----|------|-----|
| GitNexus | `query` | CSV/compare symbol map, BFF route defs |
| GitNexus | `context` | `buildCompareChannelsResponse` caller graph |
| Exa | `web_search_exa` | OWASP CSV injection, RFC 4180 |
| Svelte MCP | `svelte-autofixer` | Compare `SyncedSlugInput` (Svelte 5 runes) |
| Context7 | `query-docs` | **Blocked** — monthly quota exceeded |
| TypeScript MCP | `get_diagnostics` | **Blocked** — workspace bound to Radar, not Stream Charts |

---

## P0

**None.**

---

## P1

### P1-01 — CSV formula injection not mitigated

| | |
|---|---|
| **Location** | `packages/rollup/src/csv-export.ts` — `escapeCsvCell` (L7–11); callers `channelRankingsToCsv`, `gameRankingsToCsv`, `channelDetailToCsv` |
| **Issue** | Escaping covers RFC 4180 structural chars (`,`, `"`, CR/LF) only. Untrusted platform fields (`display_name`, `slug`, game `name`) can start with `=`, `+`, `-`, `@` and execute as spreadsheet formulas when opened in Excel/LibreOffice. |
| **Fix** | Per [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection): wrap + single-quote prefix (or tab-in-quote for Excel) when first non-whitespace char is formula-triggering. Keep RFC 4180 quote-doubling ([RFC 4180 §2.6–2.7](https://www.rfc-editor.org/rfc/rfc4180)). Add tests for `=1+1`, `+cmd`, `@SUM(1,1)`, separator/quote cell-breakout. |
| **MCP** | **GitNexus** `query("csv export compare channels API")` → `escapeCsvCell` @ `packages/rollup/src/csv-export.ts:6-11`, `rankingsChannelsCsvUrl` @ `apps/web/src/lib/export/csv-url.ts:1-15`, BFF `GET` @ `apps/web/src/routes/api/v1/compare/channels/+server.ts`. **Exa** → [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection), [WSTG CSV Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/21-Testing_for_CSV_Injection), [RFC 4180](https://www.rfc-editor.org/info/rfc4180/). |

### P1-02 — Compare UI vs API period validation mismatch

| | |
|---|---|
| **Location** | API: `packages/rollup/src/compare-api.ts` `parseCompareChannelsQuery` → `400 invalid_period` for `24h`. UI: `apps/web/src/routes/compare/+page.server.ts` uses `parseComparePeriod` → silent default `7d`. |
| **Issue** | Shareable URL `/compare?period=24h` renders 7d data; same URL on API returns 400. Rankings/compare elsewhere use stricter period resolution. |
| **Fix** | Align loader with API (400/redirect + note) or document UI-only default in OpenAPI compare description. |
| **MCP** | **GitNexus** `query` → compare `+page.server.ts:load` in `proc_165_load`; `parseCompareChannelsQuery` in `packages/rollup/test/compare-api.test.ts`. |

---

## P2

### P2-01 — Search `language=` API-only on web

| | |
|---|---|
| **Location** | Ingest `workers/ingest/src/search/channels.ts`; BFF proxy `apps/web/src/routes/api/v1/search/channels/+server.ts`; no filter on `/search` UI |
| **Issue** | Slice 4.7 ships rankings web filter; search filter exists only at API layer. |
| **Fix** | Add `LanguageFilter` to search page or document rankings-only scope in plan/OpenAPI. |

### P2-02 — Invalid `language=` silently dropped on `/channels`

| | |
|---|---|
| **Location** | `apps/web/src/lib/ui/platform.svelte.ts` `parseUiLanguage` → `null` on `invalid_language`; API `parseRankingsChannelsQuery` → `400` |
| **Issue** | `/channels?language=english` shows unfiltered list; API rejects same query. |
| **Fix** | Surface error or strip param with user-visible message. |

### P2-03 — Games rankings CSV has no UI export

| | |
|---|---|
| **Location** | BFF `api/v1/rankings/games/+server.ts` + ingest support `format=csv`; `/games` has no `ExportCsvLink` |
| **Issue** | API parity without UI entry point (4.1 deferred homepage/game detail export). |
| **Fix** | Defer or mirror `/channels` export link. |

### P2-04 — Compare discoverability

| | |
|---|---|
| **Location** | `Sidebar.svelte` → `/compare` only; no link from `channels/[slug]` |
| **Issue** | Users must know route or use sidebar. |
| **Fix** | Optional `comparePageUrl({ a: slug, … })` on channel detail. |

### P2-05 — E2E gap: compare `90d` period toggle

| | |
|---|---|
| **Location** | `apps/web/e2e/compare.spec.ts` — tests 30d URL toggle only |
| **Issue** | Phase 4.2/4.4 `90d` compare path not covered in Playwright. |
| **Fix** | Add `90d` link click + optional `periodNote` assertion. |

### P2-06 — Metrics glossary missing Phase 4 UX copy

| | |
|---|---|
| **Location** | [04-metrics-glossary](../04-metrics-glossary.md) — `90d` row only |
| **Issue** | No CSV column list, compare metric definitions, language filter semantics. |
| **Fix** | Short agency-facing subsection when docs next touched. |

### P2-07 — GitNexus under-reports BFF callers

| | |
|---|---|
| **Location** | `buildCompareChannelsResponse`, compare BFF `GET` |
| **Issue** | `context(buildCompareChannelsResponse)` lists test file only; production caller is `apps/web/src/routes/api/v1/compare/channels/+server.ts`. |
| **Fix** | Grep/cypher before refactors; re-index after route changes. |
| **MCP** | **GitNexus** `context({ name: "buildCompareChannelsResponse", repo: "Stream Charts" })` → incoming: `compare-api.test.ts` only (BFF route missing from graph). |

### P2-08 — Inline `SyncedSlugInput` on compare page

| | |
|---|---|
| **Location** | `apps/web/src/routes/compare/+page.svelte` L13–34 |
| **Issue** | Reusable slug-draft pattern not extracted; no functional defect. |
| **Fix** | Extract to `$lib/compare/` if reused. |
| **MCP** | **Svelte MCP** `svelte-autofixer` on compare `SyncedSlugInput` → `issues: []`, `suggestions: []`. |

---

## OpenAPI drift

Cross-check: `openapi/v1.yaml` vs ingest `/v1/*` vs Pages `/api/v1/*`.

| ID | Drift | Severity | Detail |
|----|-------|----------|--------|
| **D1** | Compare server scope | Intentional | Path `/compare/channels` under default ingest `servers`; live endpoint Pages-only `/api/v1/compare/channels` with `servers` override (L107–111). Ingest has no compare route (confirmed: no `compare` in `workers/ingest/src/index.ts`). |
| **D2** | BFF path prefix | Doc | Spec paths `/v1/…`; Pages implements `/api/v1/…`. Only compare documents Pages base URL. |
| **D3** | Search `language` response echo | Minor | Rankings `ChannelRankingResponse.language` when filter active (L427–429); `ChannelSearchResponse` has no echo despite `language` query param (L267–288, L636–643). |
| **D4** | BadRequest error codes | Minor | Generic `Error` schema (L774–779); concrete codes in `packages/rollup/src/api-errors.ts` (`invalid_format`, `invalid_language`, `missing_slugs`, etc.) not enumerated in spec. |
| **D5** | Compare `a`/`b` required vs UI | Intentional | OpenAPI `required: true` (L116–127); `/compare` allows empty slugs (honest empty). API returns `400 missing_slugs` per `compareQueryErrorResponse`. |

**Aligned (no drift):** `GET /v1/rankings/channels` (`format`, `language`, `90d`), `GET /v1/rankings/games` (no `language`), `GET /v1/channels/{slug}` (JSON + CSV), `GET /v1/games/{slug}` (JSON only). BFF CSV proxy forwards `format=csv` query + `Content-Disposition` via `proxyIngestResponse` (ingest uses query param, not `Accept`).

---

## MCP evidence index

| Finding | GitNexus | Exa | Svelte | Context7 | TypeScript |
|---------|----------|-----|--------|----------|------------|
| P1-01 | `escapeCsvCell`, csv-url, ingest CSV handlers | OWASP + RFC 4180 | — | quota exceeded | wrong workspace |
| P1-02 | compare load + parse tests | — | — | — | — |
| P2-07 | `context(buildCompareChannelsResponse)` | — | — | — | — |
| P2-08 | — | — | autofixer clean | — | — |

**Counts:** P0 **0** · P1 **2** · P2 **8** · OpenAPI drift **5** (2 intentional, 3 minor).
