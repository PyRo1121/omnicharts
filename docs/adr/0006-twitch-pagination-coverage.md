# ADR-0006: Twitch live directory pagination coverage

## Status

Accepted (2026-06-01)

## Context

`GET /helix/streams` uses **cursor pagination** over a **dynamic** list sorted by `viewer_count`. Twitch documents that:

- The same stream may appear on **multiple pages** as viewership changes between requests.
- A page may be **empty** near the end of the list.
- Streams may be **missing** from a full pagination pass when viewers move between pages during the sweep.

Source: [Twitch API Concepts — Pagination](https://dev.twitch.tv/docs/api/guide#pagination) (“Lists are dynamic”).

This is **not** a bug we can “fix” client-side; it is the contract. Goal: **maximize recall** for channels ≥ `TWITCH_MIN_VIEWERS` within Helix rate limits.

## Decision

Run a **coverage cycle** each minute (`runTwitchCoverageCycle`):

| Pass | Mechanism | Addresses |
|------|-----------|-----------|
| **1. Global sweep** | `GET /streams` (no filters), paginate until page peak &lt; min viewers | Broad directory; dedupe in-process |
| **2. Game pass** | `GET /streams?game_id=` for **5** rotating top games per minute | Different directory slice; long-tail games |
| **3. Reconcile** | `GET /streams?user_id=` for up to **1500** `tracked` channels seen in last **3h** | Authoritative per-channel lookup |

**Supplemental (6h cron):** full top-games discovery (`discover_twitch`) for `game_categories` + extra union.

**Phase 1b:** EventSub `stream.online` / `stream.offline` — lifecycle truth; does not replace viewer sampling ([ADR-002](./0002-twitch-eventsub-vs-polling.md)).

**Queue fan-out (`INGEST_COVERAGE_MODE=full`):** Cron enqueues **two** parallel queue messages per minute (not three):

| Message | Handler | Passes |
|---------|---------|--------|
| `poll_twitch_sweep` | `runTwitchSweepAndGamePass` | Global sweep **+** rotating game pass (shared Helix client + in-process `seenUserIds` dedup) |
| `poll_twitch_reconcile` | `runTwitchReconcileRecent` (+ chained profile enrich) | Per-channel `user_id` lookup |

Legacy `poll_twitch_game_pass` remains for admin/tests; production cron uses the combined sweep message. See `platform-coverage.ts`, `sweep-game-pass.ts`.

**Not in scope:** Perfect census of all ~30k live streams every minute (impossible per API semantics + cost).

## Helix budget (typical @ 20+ viewers)

| Pass | ~Points/cycle |
|------|----------------|
| Global | 20–50 |
| Game (5 games × ~3 pages) | 15–25 |
| Reconcile | ≤15 (1500 IDs ÷ 100) |
| **Total** | ~50–90 / min |

Well under **800** points/min per client ID.

## Consequences

- Higher API usage than global-only sweep; still cheap vs cap.
- `duplicatesSkipped` in stats — expected, not errors.
- Local/self-hosted DB (user plan) unaffected; same ingest code paths.
- Optional metrics later: `coverage_cycle` duration, unique `user_id` per hour.

## References

- https://dev.twitch.tv/docs/api/guide#pagination
- https://dev.twitch.tv/docs/api/reference#get-streams
- `workers/ingest/src/twitch/coverage.ts`
