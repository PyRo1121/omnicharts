# Phase 3 Web UI Audit — Agent 2 (Browse UI)

**Date:** 2026-06-05  
**Scope:** Phase 3 browse UI — platform params, homepage, channel/game pages, search, overview, methodology  
**Reviewer:** Audit Agent 2  
**Baseline:** [phase3-signoff](./phase3-signoff.md) · [09-ui-routes-and-components](../09-ui-routes-and-components.md) · [17-methodology-page](../17-methodology-page.md) · [01-competitive-parity-matrix](../01-competitive-parity-matrix.md) H1–H8

---

## Executive summary

Phase 3 browse UI **meets the MVP pass rule** (H1–H5 + H7a + H8a/H8b + per-platform channel/game pages). Platform URL state (`?platform=`), `PlatformFilter`, directory pages, search, slug redirect, and cross-platform 404 suggestions are implemented and covered by E2E (`phase3.spec.ts`, `kick-platform.spec.ts`, `youtube-platform.spec.ts`, `edge-cases.spec.ts`).

**Findings:** 0 P0 · 3 P1 · 8 P2. No Svelte MCP **issues**; **SearchChannels.svelte** got 5 `$effect` sync suggestions.

**Context7:** quota exceeded — SvelteKit load/`searchParams` guidance not fetched; review relied on code + [09](../09-ui-routes-and-components.md) + Svelte MCP docs.

---

## Parity matrix H1–H8

| # | Feature | MVP phase | Audit status | Evidence |
|---|---------|-----------|--------------|----------|
| H1 | Hero value prop | 2 | **PASS** | Honest copy + overview stat cards on `/` |
| H2 | Platform icon row → filters | 2–3 | **PASS** | `PlatformFilter` on homepage, overview, directories, search |
| H3 | Global channel search + suggestions | 2 | **PASS** (caveat) | Debounced combobox + `/search`; `platform=all` searches Twitch only |
| H4 | Most watched streamers (HW, 7d default) | 2 | **PASS** | `Top streamers` + `LeaderboardTable` with `?platform=` links |
| H5 | Top categories (AV, 7d default) | 2 | **PASS** | `Top categories` table + `/games/[slug]` links |
| H6 | Country filter on rankings | 4+ | **N/A (deferred)** | Not in scope; language filter on `/channels` is Phase 4.7 |
| H7 | Latest streaming news | 7+ | **N/A (out of scope)** | No news route — intentional |
| H8 | Pricing / PRO upsell | — | **PASS (substitute)** | `DonationBanner` → `/support` replaces PRO blocks |

### Extended MVP pass items (Phase 3 rule)

| # | Feature | Audit status | Evidence |
|---|---------|--------------|----------|
| H7a | Platform overview strip (HW, live count) | **PASS** | Hero stat grid on `/`; full `/overview` per platform |
| H8a | Methodology footer / page | **PASS** | `/methodology`, sidebar + footer links |
| H8b | “Tracked since” on channels | **PASS** | `ch.trackedSince` on channel header |
| H4b | 30d toggle on homepage | **PASS** | `PeriodSelector` + `?period=` via `goto` |
| H7b | “Live now” strip | **PARTIAL (expected)** | `LiveNowStrip` count only; Twitch/`all` tab; top-5 deferred Phase 4 |

---

## Citations table

| ID | Topic | File | Lines | Summary |
|----|-------|------|-------|---------|
| C1 | Platform filter UI | `apps/web/src/lib/components/ui/PlatformFilter.svelte` | 21–36 | Link-based tabs; `aria-current`; preserves platform via `hrefFor` |
| C2 | Period URL sync | `apps/web/src/routes/+page.svelte` | 51–66 | `homeQuery` builds `?period=&platform=`; `goto` on period change |
| C3 | Homepage load | `apps/web/src/routes/+page.server.ts` | 15–25 | `parseUiPlatform(url.searchParams)`; per-platform overview loaders |
| C4 | Search → slug | `apps/web/src/lib/components/ui/SearchChannels.svelte` | 77–78, 121 | `goto(/channels/{slug}?platform=…)` |
| C5 | Slug 301 redirect | `apps/web/src/routes/channels/[slug]/+page.server.ts` | 17–27 | `resolveChannelSlugFromHistory` → 301; else 404 + suggestions |
| C6 | Cross-platform 404 | `apps/web/src/routes/+error.svelte` | 59–79 | “Did you mean” with platform-aware channel links |
| C7 | Tracked since (H8b) | `apps/web/src/routes/channels/[slug]/+page.svelte` | 131–137 | Renders `Tracked since {date}` |
| C8 | Hero (H1) | `apps/web/src/routes/+page.svelte` | 73–93 | Value prop + honest ingest copy |
| C9 | Rankings tables (H4/H5) | `apps/web/src/lib/components/ui/LeaderboardTable.svelte` | 17–40 | Rows link with embedded `?platform=` |
| C10 | Donation vs PRO (H8) | `apps/web/src/lib/components/ui/DonationBanner.svelte` | 1–17 | “Support OmniCharts” CTA |
| C11 | Live now partial (H7b) | `apps/web/src/routes/+page.svelte` | 126–128 | Strip only for `twitch` \| `all` |
| C12 | LiveNowStrip link | `apps/web/src/lib/components/ui/LiveNowStrip.svelte` | 33–35 | Links `/channels` without `?platform=` |
| C13 | `all` → Twitch search | `apps/web/src/lib/ui/platform.svelte.ts` | 25–28 | `searchPlatformId('all')` returns `twitch` |
| C14 | Cross-platform search copy | `apps/web/src/lib/ui/platform.svelte.ts` | 108–112 | Subtitle claims “across Twitch, Kick, and YouTube” |
| C15 | Methodology YouTube status | `apps/web/src/routes/methodology/+page.svelte` | 104–106 | Still says tracked poll “not shipped” |
| C16 | Methodology source doc | `docs/17-methodology-page.md` | 67–71 | Same stale YouTube row |
| C17 | Phase 3 signoff | `docs/audits/phase3-signoff.md` | 18–19 | YouTube ingest marked **shipped** |
| C18 | Search `$effect` | `apps/web/src/lib/components/ui/SearchChannels.svelte` | 36–75 | `$effect.pre` syncs `query`; `$effect` runs debounced search |
| C19 | Sidebar platform nav | `apps/web/src/lib/components/layout/Sidebar.svelte` | 21–34 | `routeWithPlatform` preserves `?platform=` |
| C20 | E2E platform tabs | `apps/web/e2e/phase3.spec.ts` | 15–27 | Kick/YouTube URL updates; Twitch omits default param |
| C21 | E2E cross-platform 404 | `apps/web/e2e/phase3.spec.ts` | 79–93 | Kick-only slug on `?platform=twitch` → 404 + suggestion |
| C22 | Methodology SEO spec | `docs/17-methodology-page.md` | 170–173 | Title + meta description defined; page lacks `<meta description>` |

---

## Findings table

| Priority | File:line | Citation | Finding | Recommendation |
|----------|-----------|----------|---------|----------------|
| **P1** | `methodology/+page.svelte:104-106` | C15, C17 | YouTube ingest status says “Tracked poll not shipped” but [phase3-signoff](./phase3-signoff.md) marks YouTube ingest **shipped**. Misleading trust copy. | Update §3 table row to match shipped ingest; note quota/coverage limits per [05-ingestion](../05-ingestion-per-platform.md). Sync [17-methodology-page](../17-methodology-page.md) first (docs-as-truth). |
| **P1** | `docs/17-methodology-page.md:67-71` | C16, C17 | Source methodology doc still lists YouTube as not shipped — UI copied stale spec. | Edit doc §3 before code; regenerate or hand-sync `/methodology` sections. |
| **P1** | `platform.svelte.ts:108-112` + `SearchChannels.svelte:97` | C13, C14 | `platform=all` subtitle promises cross-platform search; `searchPlatformId('all')` → `twitch` only ([home-ui.test.ts:34-35](../../apps/web/src/lib/server/home-ui.test.ts)). | Either implement multi-platform search API + UI, or change copy to “Twitch-first while All tab selected” and document in [16-search](../16-search-and-resolution.md). |
| **P2** | `SearchChannels.svelte:36-75` | C18 | Svelte MCP flagged `$effect` state sync antipatterns (`query`, `activeIndex`, debounced `runSearch`). No hard errors. | Refactor: derive listbox index bounds; pass `initialQuery` via `{#key}` only (search page already keys); avoid `$effect.pre` → `$state` for props. |
| **P2** | `LiveNowStrip.svelte:33-35` | C12 | “Browse channels →” drops active platform (`/channels` not `/channels?platform=kick`). | Use `routeWithPlatform('/channels', activePlatform)` from layout context or prop. |
| **P2** | `methodology/+page.svelte` (head) | C22 | Missing SEO `<meta name="description">` specified in doc 17. | Add `<svelte:head>` title + description from [17](../17-methodology-page.md#seo-metadata). |
| **P2** | `Sidebar.svelte:11` | — | Phase 4 `/compare` in main nav during Phase 3 audit scope. | Acceptable if intentional preview; otherwise hide until Phase 4 GA or gate behind feature flag. |
| **P2** | `+page.svelte:131` + `uiRankingPeriods` | C2 | Homepage exposes 24h + 90d toggles; [09](../09-ui-routes-and-components.md) homepage tree lists 7d + 30d only. | Document 90d/24h on homepage in doc 09, or restrict homepage `PeriodSelector` to `['7d','30d']` per original MVP spec. |
| **P2** | `channels/[slug]/+page.svelte:60` | — | Breadcrumb `Channels` link omits `?platform=` | Append `ch.platform` to breadcrumb href. |
| **P2** | `Footer.svelte:18-19` | — | Footer `/channels`, `/games` ignore platform context | Optional: append `$page.url.searchParams` platform when present. |
| **P2** | `Sidebar.svelte:2`, `AppShell.svelte:2` | — | Uses legacy `$app/stores` `page` store vs Svelte 5 `$app/state` | Migrate when touching layout; not blocking Phase 3. |

---

## Flow trace (GitNexus)

**Homepage → search → channel slug resolution**

```
/ (+page.svelte)
  └─ SearchChannels (client fetch /api/v1/search/channels)
       └─ goto /channels/{slug}?platform={platform_id}
            └─ channels/[slug]/+page.server.ts
                 ├─ loadChannelDetail(ctx, slug, platformId, period)
                 ├─ not_found → resolveChannelSlugFromHistory → redirect 301
                 └─ still not_found → findChannelOnOtherPlatforms → error(404, { suggestions })
                      └─ +error.svelte “Did you mean” links
```

GitNexus processes: `PublicSearchChannels` (ingest) ↔ `apps/web/src/lib/server/search.ts:searchChannels` ↔ `loadChannelDetail` ↔ slug history redirect ([C4–C6]).

---

## Svelte MCP results

| Component | Issues | Suggestions | Notes |
|-----------|--------|-------------|-------|
| `SearchChannels.svelte` | **0** | **5** | `$effect` / `$state` sync malpractice hints; `require_another_tool_call_after_fixing: true` |
| `+page.svelte` (homepage) | 0 | 0 | Clean |
| `PlatformFilter.svelte` | 0 | 0 | Clean |

**Svelte MCP flagged issues:** **No** (zero `issues` arrays populated). **Yes** for suggestions on SearchChannels only.

---

## E2E coverage (platform)

| Spec | Focus |
|------|-------|
| `phase3.spec.ts` | Tab URL updates; Kick channel/game detail; slug 301; cross-platform 404 |
| `kick-platform.spec.ts` | No Phase 3 banners; nav preserves `?platform=kick`; search subtitle |
| `youtube-platform.spec.ts` | YouTube tab shell; demo preview; directory copy |
| `edge-cases.spec.ts` | Invalid platform → Twitch; methodology loads; platform cycle |
| `smoke.spec.ts` | Homepage 200; search listbox; channel page when ingest up |

**Gap:** No E2E for `platform=all` tab behavior or cross-platform search copy mismatch ([P1](#findings-table)).

---

## Counts

| Metric | Value |
|--------|-------|
| P0 | **0** |
| P1 | **3** |
| P2 | **8** |
| Parity H1–H5 | **5/5 PASS** |
| Parity H6–H7 | **N/A (deferred / out of scope)** |
| Parity H8 | **PASS (DonationBanner substitute)** |
| Extended H7a, H8a, H8b, H4b | **PASS** |
| Extended H7b | **PARTIAL (documented)** |
| Svelte MCP hard issues | **0** |
| Svelte MCP suggestions | **5** (SearchChannels only) |

---

## Verdict

**Phase 3 browse UI: ship-ready** with doc/copy fixes recommended before public beta. Priority: sync methodology YouTube status (P1) and clarify `platform=all` search semantics (P1). SearchChannels `$effect` refactor is quality debt, not a blocker.
