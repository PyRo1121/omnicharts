# Vision and principles

## One-liner

**OmniCharts** makes cross-platform streaming intelligence free and accessible — starting with Twitch, Kick, and YouTube — with **growing ingest history** and fewer gates than incumbent analytics sites.

## Problem

Tools like [Streams Charts](https://streamscharts.com/), [StreamMetrix](https://streammetrix.com/), [SullyGnome](https://sullygnome.com/), and [TwitchTracker](https://twitchtracker.com/) aggregate data that individual creators and small agencies cannot easily collect themselves. Many features are paywalled, credit-metered, or limited to short date ranges on free tiers.

## Solution

1. **Ingest** from official APIs on a schedule we control.
2. **Store** rollups in open, documented schemas.
3. **Serve** a fast SvelteKit UI plus a generous free API.
4. **Expand** retention as storage allows (30 → 90 → 365 → since first tracked).

## Principles

| Principle | Implication |
|-----------|-------------|
| **Docs before code** | Change `docs/` when requirements change; AI and humans use the same spec. |
| **Free first** | No paywalls at launch; donations only. Revisit paid tiers only for real marginal cost. |
| **Own the data pipeline** | No scraping Streams Charts; no reselling their API. |
| **Honest limits** | UI explains what platforms allow (e.g. Twitch VOD expiry). |
| **Solo-maintainable** | Prefer boring tech: SvelteKit, SQLite/D1, cron ingest, precomputed rollups. |
| **Cloudflare-ready** | Design for Workers + D1 + R2; avoid long-running servers. |

## Users (all v1 audiences)

1. **Streamers** — look up their channel, compare to peers, share stats.
2. **Agencies / brands** — rank creators, filter by game/platform, export CSV (later).
3. **API consumers** — embed rankings and channel stats in dashboards.

Same product surface; entitlements differ only when/if we add rate limits later.

## Success criteria

### Documentation phase (now)

- [x] Parity matrix covers homepage MVP with pass/fail per item.
- [x] Metrics glossary defines every number shown on MVP pages.
- [x] Ingest doc states API endpoints, rate limits, and history ceilings per platform.
- [x] Cloudflare architecture validated (Free vs Paid, Queues, D1 budgets).
- [x] Discovery, ranking rules, observability, ADRs.
- [x] Search/slug resolution, methodology page copy, legal checklist, OpenAPI draft.

**Phase 0 documentation: complete (v2.2).** Includes Kick/YouTube ingest depth + [CLI scaffold guide](./19-project-scaffold-and-commands.md). Next: Phase 1 — run scaffold commands, then ingest ([ROADMAP.md](../ROADMAP.md)).

### MVP phase

- [ ] Homepage loads &lt; 3s on mobile (cached rankings).
- [ ] Top 100 streamers by Hours Watched (7d) match order-of-magnitude sanity vs public sources.
- [ ] Channel search resolves Twitch/Kick/YouTube handles.
- [ ] 30 days of charts on channel pages for actively ingested channels.

### Trust phase

- [ ] Methodology page linked from footer.
- [ ] “Data since {date}” on every channel.

## Non-goals (v1)

See [10-non-goals-and-risks.md](./10-non-goals-and-risks.md).

## Naming and branding

- **Product name:** OmniCharts
- **Avoid:** “Streams Charts”, “Stream Charts” in user-facing copy (trademark confusion).
- **Domain:** TBD — register before public launch.

## Decision log

| Date | Decision |
|------|----------|
| 2026-06-01 | Name OmniCharts; platforms Twitch+Kick+YouTube; free + donations; ingest strategy A (official APIs); Cloudflare target host; MVP = Streams Charts homepage scope; foreground doc pass |
