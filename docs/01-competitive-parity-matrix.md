# Competitive parity matrix

## Landscape

| Product | Focus | Platforms | Pricing model | OmniCharts takeaway |
|---------|--------|-----------|---------------|---------------------|
| [Streams Charts](https://streamscharts.com/) | Market intelligence, tools, news | 15+ | PRO $80+, per-platform modules, API credits | **Primary UX reference** for homepage MVP |
| [StreamMetrix](https://streammetrix.com/) | Cross-platform DB, agencies | Twitch, YouTube, Kick (rolling) | Unknown / freemium | Closest direct competitor positioning |
| [SullyGnome](https://sullygnome.com/) | Deep Twitch history, games | Twitch | Free (donations) | Gold standard for **multi-year Twitch** — we cannot match day one without years of ingest |
| [TwitchTracker](https://twitchtracker.com/) | Channel/game stats | Twitch | Free + ads | Strong channel pages; reference for charts |
| [StreamElements](https://streamelements.com/) | Streamer tools, overlays | Twitch, etc. | Free tools | Complementary, not analytics-first |
| Twitch native / YouTube Studio | Own-channel only | 1 each | Free | No cross-channel rankings |

**Positioning:** OmniCharts = **Streams Charts–class homepage and rankings** for **Twitch + Kick + YouTube**, **free**, with transparent methodology and API — not 15 platforms or 35 tools on day one.

---

## Streams Charts homepage — MVP checklist

Reference: [streamscharts.com](https://streamscharts.com/) (captured 2026-06).

| # | Feature | MVP? | Phase | Notes |
|---|---------|------|-------|-------|
| H1 | Hero: “largest database…” value prop | Yes | 2 | OmniCharts copy; honest scale (“since we started tracking”) |
| H2 | Platform icon row → overview filters | Yes | 2–3 | MVP: Twitch, Kick, YouTube only (not Trovo, CHZZK, …) |
| H3 | Global channel search + suggestions | Yes | 2 | Debounced search against `channels` index |
| H4 | “Most watched streamers” table (default 7d, HW) | Yes | 2 | Core ranking; link to `/channels/[slug]` |
| H5 | “Top categories” table (default 7d, AV) | Yes | 2 | `/games/[slug]` |
| H6 | “All creators” / country filter on rankings | Defer | 4+ | Needs geo ingest or manual tags |
| H7 | “Latest streaming news” cards | No | 7+ | Editorial; RSS or manual blog |
| H8 | Pricing / PRO upsell blocks | No | — | We are free; replace with “Support OmniCharts” donation |
| H9 | Solutions grid (streamer / PRO / API / enterprise) | No | 6+ | Simplify to single “API” footer link when ready |
| H10 | Testimonials / logos carousel | No | 5+ | Social proof when available |
| H11 | Use-case sections (6 marketing blocks) | No | 5+ | Landing polish |
| H12 | Sister products (Mirai, ChessWatch, …) | No | — | Out of scope |
| H13 | Footer: platforms, tools, legal | Partial | 2 | Minimal footer; expand later |

**MVP pass rule (Phase 3):** H1–H5 + **H7a** (overview strip) + **H8a/H8b** (methodology + tracked since) + working **channel** and **game** pages for **each** of Twitch, Kick, YouTube.

**Phase 2 (Twitch slice):** Same loop, Twitch tab only.

| # | Feature | MVP? | Phase | Notes |
|---|---------|------|-------|-------|
| H7a | Platform overview strip (HW, live count) | Yes | 2 | `/overview` or on `/` |
| H8a | Methodology footer | Yes | 2 | Trust differentiator |
| H8b | “Tracked since” on channels | Yes | 2 | `first_observed_at` |
| H4b | 30d toggle on homepage tables | Yes | 2 | Not only channel pages |
| H7b | “Live now” top strip | Partial | 3 | Full `/live` Phase 4 |
| H9 | Cross-platform merged HW table | No | 4+ | Per-platform tabs until then |
| H10 | Trending / fastest growing | No | 4 | SullyGnome-style |

---

## Page-level parity (post-homepage)

| Page | Streams Charts route | OmniCharts route | MVP? |
|------|---------------------|------------------|------|
| Platform overview | `/overview?platform=` | `/overview` | Phase 2–3 |
| All platforms compare | `/platforms` | `/platforms` | Phase 4 |
| Channel profile | `/channels/{slug}` | `/channels/[slug]` | Phase 2 |
| Game/category | `/games/{slug}` | `/games/[slug]` | Phase 2 |
| Channel directory | `/channels` | `/channels` | Phase 3 |
| Game directory | `/games` | `/games` | Phase 3 |
| Live now | `/top-live-channels` | `/live` | Phase 4 |
| Stream detail | `/streams/...` | `/streams/[id]` | Phase 4 |
| Tools hub | `/tools` | `/tools` | Phase 6+ |
| News | `/news` | `/news` | Phase 7+ |
| API marketing | `/api` | `/developers` | Phase 6 |

---

## Metric parity (MVP)

| Metric | On Streams Charts homepage | OmniCharts MVP |
|--------|---------------------------|----------------|
| Hours Watched | Yes (streamers table) | Yes — sum of `viewer_count` samples × interval |
| Average Viewers | Yes (games table) | Yes |
| Peak Viewers | Channel pages | Phase 2 channel page |
| Follower gain | Channel pages | Phase 2 — daily snapshots; **follower total** via Helix app token (2026-06) |
| Unique viewers | PRO | Phase 6+ (Twitch estimates hard) |
| Chat stats | PRO | Phase 7+ |

---

## Differentiators (intentional)

| We do | Incumbents often don’t |
|-------|-------------------------|
| Free browse + methodology at launch | Credit meters, $80/mo PRO |
| Free CSV + API (Phase 4–6) | Metered Jazz API |
| Public methodology docs | Black-box “estimated audience” |
| Open schema in `docs/06` | Closed warehouse |

---

## Status tracking

Update the **Status** column as phases complete. Pre–Kick freeze gate: [23](./23-audit-remediation-plan.md#2-freeze-gate-twitch-frozen--kick-may-start) · [26](./26-twitch-freeze-execution-plan.md) (G1 ✅ local verify; G2 ✅ remote D1; G3–G12 open).

| Item | Status |
|------|--------|
| Documentation | Complete (v2.8 — Phase 0–2 sync, 2026-06-03) |
| Phase 0–2 (Twitch loop) | **Shipped** — ROADMAP Phase 0 exit met; Phase 1 ingest + Phase 2 UI |
| Twitch ingest (Phase 1–2 backend) | **Shipped** — rankings, channel/game API, sightings, followers_delta, sample prune, migrations through `0008` |
| Homepage MVP (Twitch) | **Shipped** — H1–H5, H7a, H8a/b, 7d+30d; H7b partial (count + link, top-5 deferred Phase 4) |
| Kick + YouTube | **Shipped** — Phase 3 sign-off 2026-06-05 ([phase3-signoff](./audits/phase3-signoff.md)) |
| CSV export | **Partial** — channel rankings + channel detail API/UI (Phase 4 slice 4.1) |
| 90-day retention | Not started — UI hides `90d` until Phase 4 ([REM-022](./23-audit-remediation-plan.md)) |
| Cloudflare prod | Not started — ingest requires Workers Paid ([ADR-004](./adr/0004-cloudflare-free-vs-paid.md)) |

### Phase 2 Twitch parity (shipped)

| # | Feature | Status |
|---|---------|--------|
| H1 | Hero value prop | Shipped |
| H2 | Platform tab (Twitch active; Kick/YT tabs UI) | Shipped (Twitch data) |
| H3 | Global channel search | Shipped |
| H4 | Most watched streamers (HW) | Shipped |
| H5 | Top categories (AV) | Shipped |
| H7a | Overview strip | Shipped |
| H8a | Methodology | Shipped — `/methodology` |
| H8b | Tracked since | Shipped |
| H4b | 30d toggle | Shipped |
| H7b | Live now strip | Partial — count + link; top-5 deferred |
| H9 | Cross-platform merged HW | Deferred Phase 4+ |
