# ADR-0003: Kick via official Public API (not a blocker)

## Status

Accepted (2026-06-01) — supersedes “Kick may be blocked” notes  
**Amended:** 2026-06-01 — OAuth hosts, batching, webhooks, compliance  
**Implementation (2026-06-05):** Tracked poll + category discovery — `workers/ingest/src/kick/{auth,api,poll,discover,webhook}.ts`; queue `poll_kick_tracked` + `discover_kick` wired; `NEEDS_API` when secrets absent. Webhook handler: `POST /webhooks/kick/events` verifies RSA signature (`KICK_WEBHOOK_PUBLIC_KEY`), handles `livestream.status.updated` v1 for session open/close only.

## Context

Kick Dev Public API v1 at `https://api.kick.com` with OAuth on `https://id.kick.com` documents:

- App Access Token (`client_credentials`)
- `GET /public/v1/livestreams` with `viewer_count` (≤50 `broadcaster_user_id` per request)
- Webhooks for lifecycle — **no viewer metrics in payloads**
- No historical concurrent API; no paginated global live directory (`limit=100` per category query)

Risks: unpublished rate limits, hidden viewer counts, Schedule 1 storage rules for long-term warehouses.

## Decision

1. **Proceed with Kick** in Phase 3 via [dev.kick.com](https://dev.kick.com/).
2. **Authenticate** with App Access Token; refresh on 401.
3. **Poll** `GET /public/v1/livestreams` every 60–120s for tracked live set.
4. **Discover** via `GET /public/v2/categories` + category-scoped livestreams ([12-channel-discovery](../12-channel-discovery-and-tracking.md)).
5. **Optional webhooks** for session boundaries only — not for HW/AV.
6. **Throttle** ~1 req/s until limits published.
7. **Fallback:** Twitch + YouTube if Kick unusable at MVP scale.

## Consequences

- [Developer ToS](https://dev.kick.com/terms-of-service); legal review for retention ([18-legal](../18-legal-and-compliance-checklist.md)).
- Secrets: `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` on ingest Worker only.

## References

- https://docs.kick.com/
- https://api.kick.com/swagger/doc.yaml
- [05-ingestion-per-platform.md](../05-ingestion-per-platform.md)
