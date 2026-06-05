# UI routes and components

**Framework:** SvelteKit 2 + TypeScript + Vite.

**Styling:** TBD (Tailwind or vanilla CSS). Dark-first to match category norms.

---

## Route map

| Route | Page | MVP phase |
|-------|------|-----------|
| `/` | Homepage | 2 |
| `/overview` | Platform stats dashboard | 2–3 |
| `/compare` | Two-channel compare (7d/30d/90d) | 4 |
| `/platforms` | Cross-platform compare | 4 |
| `/channels` | Directory + filters | 3 |
| `/channels/[slug]` | Channel profile | 2 |
| `/games` | Game directory | 3 |
| `/games/[slug]` | Game profile | 2 |
| `/live` | Live now leaderboard | 4 |
| `/streams/[id]` | Single stream | 4 |
| `/search` | Search results (optional; may inline on `/`) | 2 |
| `/methodology` | How we measure | 2 — copy from [17-methodology-page.md](./17-methodology-page.md) |
| `/privacy` | Privacy Policy | Before public beta — [18](./18-legal-and-compliance-checklist.md) |
| `/terms` | Terms of Service | Before public beta |
| `/developers` | API docs (OpenAPI) | 6 — [openapi/v1.yaml](../openapi/v1.yaml) |
| `/support` | Donations + contact | 2 |

Query params:

- `?platform=twitch|kick|youtube` on channel, game, overview, homepage tables.
- `/compare?a={slug}&b={slug}&platform=twitch|kick|youtube&period=7d|30d|90d` — two-channel rollup compare (Phase 4).

---

## Compare (`/compare`) — Phase 4 slice 4.4

```
ComparePage
├── CompareSlugForm           # a + b slug inputs, submit → same route
├── PeriodSelector            # 7d | 30d | 90d (no 24h)
├── CompareSideCard × 2       # avatar, name, metric list, honest empty states
└── CompareMetricsTable       # accessible side-by-side table fallback
```

**Data loading:** `+page.server.ts` loads two channel rollup summaries via `loadChannelCompare` (parallel `loadChannelDetail` / D1 rollup reads). `Cache-Control: public, max-age=60`.

**Empty states:**

- Missing `a` or `b` — picker copy + search link
- `not_found` — “Channel not found”
- `discovered` — not promoted to tracked sampling yet
- Tracked but zero rollup rows in period — honest partial totals note

**API:** `GET /api/v1/compare/channels?a=&b=&platform=&period=` (rollup-only composite; OpenAPI `GET /v1/compare/channels`).

---

## Homepage (`/`) — component tree

```
HomePage
├── SiteHeader
│   ├── Logo
│   ├── PlatformTabs          # Twitch | Kick | YouTube
│   └── ChannelSearch         # spec: [16-search-and-resolution.md](./16-search-and-resolution.md)
├── HeroSection               # value prop + scale stats (honest)
├── TopStreamersTable
│   ├── PeriodToggle          # 7d default; 30d Phase 2 MVP
│   └── RankedChannelRow × N
├── TopCategoriesTable
│   └── RankedGameRow × N
├── DonationBanner            # replaces Streams Charts pricing CTA
└── SiteFooter
```

### TopStreamersTable props

| Prop | Type |
|------|------|
| `platform` | PlatformSlug |
| `period` | `7d` \| `30d` \| `90d` |
| `rows` | `{ rank, slug, displayName, avatarUrl, hoursWatched }[]` |

### TopCategoriesTable props

| Prop | Type |
|------|------|
| `platform` | PlatformSlug |
| `period` | `7d` \| `30d` \| `90d` |
| `rows` | `{ rank, slug, name, boxArtUrl, averageViewers }[]` |

---

## Channel page (`/channels/[slug]`)

```
ChannelPage
├── ChannelHeader             # avatar, name, platform badge, tracked_since
├── PeriodSelector            # 24h | 7d | 30d | 90d
├── MetricCards               # HW, AV, PV, airtime, streams, follower Δ
├── ViewershipChart           # daily HW or AV (uPlot / Layer Cake)
├── RecentStreamsTable
└── Breadcrumb
```

**Data loading:** `+page.server.ts` loads rollups from D1/SQLite; `env.DB.batch()` for homepage blocks; `Cache-Control: public, max-age=60` on all public ranking pages.

---

## Game page (`/games/[slug]`)

```
GamePage
├── GameHeader                # box art, name
├── MetricCards               # aggregate AV, HW, channels live
├── TopChannelsTable          # channels in this game, 7d
└── ViewershipChart           # game-level daily AV
```

---

## Overview (`/overview`)

Platform-level cards:

- Active channels (live now)
- Total hours watched (7d)
- Peak concurrent (platform-wide estimate)
- Top game by HW

Replicates [streamscharts.com/overview](https://streamscharts.com/overview) spirit without claiming 15 platforms.

---

## Shared components

| Component | Responsibility |
|-----------|----------------|
| `PlatformBadge` | Icon + label |
| `MetricCard` | Label, value, delta % |
| `DataTable` | Sortable columns, skeleton loaders |
| `EmptyState` | “Not tracked yet” + explain ingest |
| `ErrorBanner` | API/DB failures |

---

## Charts

**Library:** [uPlot](https://github.com/leeoniya/uPlot) (small) or Layer Cake (Svelte-native).

**Requirements:**

- Responsive width
- No SSR canvas issues — render chart in `onMount` or use Layer Cake SSR-friendly paths

---

## SEO

| Route | `title` pattern |
|-------|-----------------|
| `/channels/[slug]` | `{displayName} Twitch Stats · OmniCharts` |
| `/games/[slug]` | `{gameName} Stats · OmniCharts` |
| `/` | `Live Streaming Stats · OmniCharts` |

`sitemap.xml` generated at build for top N channels (Phase 3+).

---

## Accessibility

- Tables: proper `<th scope="col">`
- Chart: provide data table fallback link
- Search: keyboard navigable listbox
