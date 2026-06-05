# Metrics glossary

All public numbers must trace to a definition here. When implementation differs, update this file first.

## Core metrics (MVP)

### Hours Watched (HW)

**Definition:** Sum over all viewer samples in the period of:

```
viewer_count × sample_interval_hours
```

**Default sample interval:** 1 minute (Twitch ingest target). If actual interval varies, use elapsed time between samples per segment.

**Use:** Primary sort for “Most watched streamers.”

**Caveats:**

- Offline time contributes 0.
- Raid/host inflation: document if we exclude hosted segments (Phase 4+).

---

### Average Viewers (AV)

**Definition:**

```
HW / airtime_hours
```

Equivalently: time-weighted mean of `viewer_count` while live.

**Use:** Primary sort for “Top categories” and channel summaries.

---

### Peak Viewers (PV)

**Definition:** Maximum `viewer_count` in period (per channel or per stream).

**Use:** Channel headers, stream cards.

---

### Airtime (AT)

**Definition:** Total minutes (or hours) the channel was live in period.

**Derivation:** Union of `[started_at, ended_at]` for sessions; for live polling, mark live when platform reports `is_live`.

---

### Stream count

**Definition:** Count of distinct `StreamSession` rows with `started_at` in period.

---

### Followers gain

**Definition:** `followers_end - followers_start` for period.

**Source:** Platform API snapshots at period boundaries. If only current total available, omit or show “—”.

---

## Derived / later metrics

| Metric | Definition | Phase |
|--------|------------|-------|
| Unique Viewers | Distinct viewers in period | 6+ (platform-specific; may be unavailable) |
| Estimated Audience | Modeled reach | 6+; show confidence |
| Chat Engagement Rate | Active chatters / viewers | 7+ |
| Active Chatters | Distinct chatters | 7+ |
| Audience overlap | % shared viewers between channels | 7+ (needs auth or estimates) |
| Retention / bounce | Viewer drop-off over stream duration | 7+ |
| Subs / bits revenue | Twitch monetization | 7+; API scopes |

---

## Ranking periods

| Key | Label | MVP |
|-----|-------|-----|
| `7d` | Last 7 days | Yes (homepage default) |
| `30d` | Last 30 days | Yes (homepage + channel pages, Phase 2) |
| `90d` | Last 90 days | Phase 4 |
| `365d` | Last 365 days | Phase 7 |

**Window definition:** Rolling **7×24 hours UTC** ending at the latest completed daily rollup (not calendar week Mon–Sun unless labeled).

**Partial tracking:** Include days with data; do not annualize. Channel with 2 of 7 days tracked still ranks with summed HW (eligibility rules in [12](./12-channel-discovery-and-tracking.md)).

Custom ranges: Phase 6+ (agency use case).

---

## Ranking sort and tie-break

| Sort | Primary key | Tie-break 1 | Tie-break 2 |
|------|-------------|-------------|-------------|
| Top streamers | `hours_watched` DESC | `average_viewers` DESC | `slug` ASC |
| Top games | `average_viewers` DESC (platform-game rollup) | `hours_watched` DESC | `slug` ASC |

---

## Game-level Average Viewers (rollup)

For a `(platform, game, date)`:

```
game_AV = sum(channel_HW for channels in game) / sum(channel_airtime_hours in game)
```

Equivalently: airtime-weighted mean of channel AVs. **Do not** average channel AVs without weighting.

SQL pattern: aggregate HW and airtime separately, then divide.

---

## Cross-platform rules

1. **Never sum HW across platforms** for a single table row without labeling “combined.”
2. Homepage tables are **per platform** or **explicitly labeled “all platforms”** (Phase 4+).
3. YouTube “Gaming” live only — exclude VOD-only channels from live rankings.

---

## Display formatting

| Type | Format |
|------|--------|
| HW ≥ 1M | `1.23M` or `1 234 567` (pick one locale strategy) |
| AV | Integer or one decimal |
| Duration | `42h 15m` |

Store integers in DB; format in UI.

---

## Methodology page (public)

Short user-facing explanations:

- “We sample Twitch every ~60s while a channel is live.”
- “Hours Watched is estimated from concurrent viewer counts, not unique people.”
- “Data before {first_observed_at} is not available.”

Link from footer: `/methodology`.
