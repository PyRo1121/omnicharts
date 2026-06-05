# User personas and journeys

## Persona 1 — Independent streamer (“Sam”)

**Goals:** See if last week beat the prior week; find rank among same game; share a stat card on social.

**Pain:** Twitch Analytics only shows own channel; Streams Charts paywalls long ranges and exports.

### Journey: Weekly check-in

1. Land on `/` → search own handle.
2. Open `/channels/sam?platform=twitch`.
3. View 7d / 30d: Hours Watched, Avg Viewers, Peak, hours live.
4. (Later) Compare with friend via `/tools/compare`.

**MVP requirements:** Search, channel page, 7d default, mobile-friendly charts.

---

## Persona 2 — Agency analyst (“Jordan”)

**Goals:** Shortlist creators for a campaign; export top 50 in “Just Chatting” for Brazil.

**Pain:** PRO filters and CSV exports are expensive; data scattered across sites.

### Journey: Campaign scouting

1. `/games/just-chatting` → top channels 7d.
2. Sort by Hours Watched; open 5 channel tabs.
3. (Phase 6) Export CSV; (Phase 4) filter by language tag if available from API.

**MVP requirements:** Game ranking page, stable sort, canonical URLs for reports.

---

## Persona 3 — Developer (“Riley”)

**Goals:** Pull top-100 Kick channels into internal BI; refresh daily.

**Pain:** Streams Charts API credits; unclear rate limits.

### Journey: API integration

1. Read `docs/07-api-spec.md`.
2. Register API key (Phase 6).
3. `GET /v1/rankings/channels?platform=kick&period=7d&limit=100`.
4. Cron job at agency; cache responses.

**MVP requirements:** Document future API shape now; versioned JSON; predictable rate limits (generous when launched).

---

## Shared needs

| Need | Streamer | Agency | API |
|------|----------|--------|-----|
| Accurate HW/AV | ✓ | ✓ | ✓ |
| Cross-platform same slug | ✓ | ✓ | ✓ |
| Honest “tracked since” | ✓ | ✓ | ✓ |
| No login for browse | ✓ | ✓ | ✓ |
| Export | nice | ✓ | ✓ |

---

## Auth (deferred)

- **Phase 2–5:** No account required for public stats.
- **Phase 6+:** Optional login for API keys, saved lists, agency watchlists.
- **Never required** to view public rankings (free mission).

---

## Copy tone

- Direct, data-forward.
- Avoid claiming “world’s largest database” until true.
- Prefer: “Rankings from OmniCharts ingest, updated every {interval}.”
