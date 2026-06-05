# Methodology page (`/methodology`)

**Purpose:** User-facing copy for the public methodology page. Implement as SvelteKit route with sections below. Tone: clear, honest, no hype.

**Route:** `/methodology` (Phase 2 MVP, [01-competitive-parity-matrix](./01-competitive-parity-matrix.md) H8a).

Technical definitions: [04-metrics-glossary.md](./04-metrics-glossary.md). Ingest detail: [05-ingestion-per-platform.md](./05-ingestion-per-platform.md).

---

## Page title

**How OmniCharts measures streaming statistics**

---

## Section 1 — Introduction

OmniCharts collects public data from **Twitch**, **Kick**, and **YouTube** through each platform’s official APIs. We do not buy or scrape third-party analytics databases.

Our numbers are **estimates of viewership activity** based on how many people were watching at the moments we sample. They are not the same as a platform’s internal analytics dashboard, and they are not a count of unique people unless we say so explicitly.

We show **“Tracked since”** on each channel profile: the date we first started recording that channel. We cannot show minute-by-minute history from before that date.

---

## Section 2 — What we measure

### Hours Watched

The main ranking metric for “most watched” lists.

We add up viewer counts over time while a channel is live:

**Hours Watched ≈ sum of (concurrent viewers × time between samples)**

If we sample about once per minute, each sample contributes roughly `viewers ÷ 60` hours.

This rewards long streams and high concurrent viewership. It does not count offline time.

### Average Viewers

**Average Viewers = Hours Watched ÷ hours live** in the selected period.

This is a time-weighted average, not “average of peak viewers.”

### Peak Viewers

The highest concurrent viewer count we observed in the period.

### Airtime

Total time the channel was live in the period, based on when platforms report a stream as online.

### Stream count

How many distinct live broadcasts started in the period.

### Follower change

When the platform API provides follower totals, we store snapshots and show the difference over the period. If data is missing, we show “—”.

---

## Section 3 — How often we update

| Platform | Typical sample interval (while live) |
|----------|--------------------------------------|
| Twitch | About every 60 seconds |
| Kick | About every 60–120 seconds |
| YouTube | About every 120 seconds |

Rankings and charts use **daily rollups** built from these samples. The site may cache public pages for up to **60 seconds**.

We detect when a channel goes live or offline using platform signals (including Twitch EventSub where available). We do not poll offline channels every minute.

---

## Section 4 — Who appears in rankings

A channel may appear in public leaderboards when:

- We actively track it (`tracked` in our system)
- It had at least about **60 minutes** of live time in the period
- Its average viewership in the period is at least about **2** concurrent viewers

Smaller or inactive channels may still have a profile page with limited or no charts.

We discover new channels from popular categories and live directories. We do not list every account on a platform.

---

## Section 5 — History and “full career”

**We only have detailed history from the day we started tracking a channel forward.**

Platforms do not give third-party services a full lifetime of minute-level viewer data. Twitch past broadcasts (VODs) expire after a short window (often **7–60 days**, depending on the broadcaster). YouTube and Kick do not provide years of concurrent viewer curves through public APIs.

Sometimes we backfill **metadata** from recent VODs where allowed. That is labeled separately and is not the same as live sampling.

Over time, channels we track continuously will show longer charts on OmniCharts as our database grows.

---

## Section 6 — Cross-platform comparisons

Twitch, Kick, and YouTube are separate tables and separate channel pages.

**Do not add Hours Watched across platforms** unless we explicitly label a view as “combined.” Default rankings are **per platform**.

The same person may have different accounts on different platforms. We treat those as separate channels unless we add a manual “creator link” feature in the future.

---

## Section 7 — Known limitations

| Topic | Limitation |
|-------|------------|
| Unique viewers | We generally show concurrent viewers and Hours Watched, not unique people |
| Raids and hosts | Included in viewer counts during our samples; we may refine this later |
| Hidden view counts | Some Kick or YouTube streams hide viewer numbers; we may show gaps |
| YouTube quota | We track a subset of YouTube Gaming channels, not the entire site |
| Restreams / bots | We do not manually audit every channel; unusual patterns may affect rankings |
| Comparison to other sites | Other analytics sites have their own ingest and may disagree with our numbers |

---

## Section 8 — Data sources and affiliation

OmniCharts uses:

- [Twitch Helix API](https://dev.twitch.tv/docs/api/) and EventSub
- [Kick Developer API](https://docs.kick.com/) where available
- [YouTube Data API](https://developers.google.com/youtube/v3)

**OmniCharts is not affiliated with, endorsed by, or sponsored by Twitch, Kick, YouTube, or Google.**

Trademarks belong to their owners. Streamer names and images are used for identification and remain property of their respective owners.

---

## Section 9 — API and exports

When our public API and CSV exports are available, they use the same rollups as the website. API documentation will describe rate limits and fields.

We do not sell access to another company’s database. Our API serves **OmniCharts data only**.

---

## Section 10 — Contact and corrections

If you believe a channel’s platform ID or slug is wrong, or you represent a rights holder with a takedown request, contact us at: **support@omnicharts.com** (placeholder — replace before launch).

We aim to correct metadata errors when platforms update their APIs.

---

## Footer links (site-wide)

- Methodology (this page)
- Privacy Policy → `/privacy` ([18-legal-and-compliance](./18-legal-and-compliance-checklist.md))
- Terms of Service → `/terms`
- Developers / API → `/developers` (when live)

---

## SEO metadata

| Field | Value |
|-------|-------|
| `title` | How we measure stats · OmniCharts |
| `description` | How OmniCharts calculates Hours Watched, Average Viewers, and rankings for Twitch, Kick, and YouTube using official APIs. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-01 | Initial public copy (doc v2 P1) |
