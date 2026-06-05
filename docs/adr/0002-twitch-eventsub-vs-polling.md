# ADR-0002: Twitch EventSub for lifecycle, Helix for metrics

## Status

Accepted (2026-06-01)

## Context

Twitch offers EventSub (stream online/offline) and Helix `GET /streams` (`viewer_count`). EventSub WebSocket has very low `max_total_cost` (10). Webhook allows thousands of subscriptions.

EventSub does **not** stream per-minute viewer counts for arbitrary channels without broadcaster OAuth ([Twitch discuss](https://discuss.dev.twitch.com/t/eventsub-limits-problem/59759)).

## Decision

| Concern | Mechanism |
|---------|-----------|
| Live vs offline | EventSub **webhook**: `stream.online`, `stream.offline` |
| Viewer samples | **Helix poll** `GET /helix/streams` in batches of 100, ~60s for live set |
| Reconciliation | Daily poll of `dormant` + mismatch repair job |
| Do not use | EventSub WebSocket for catalog scale |

## Consequences

- Requires HTTPS webhook endpoint on Cloudflare Worker.
- Reduces polls on offline `tracked` channels (cost savings).
- Still subject to Helix 800 points/min (ample for MVP caps in [12-channel-discovery](../12-channel-discovery-and-tracking.md)).

## Implementation notes (verified 2026-06-01)

- App token: `POST https://id.twitch.tv/oauth2/token` (not `api.twitch.tv`).
- Helix: every request needs `Authorization` + `Client-Id` matching the token client.
- Subscribe: `POST https://api.twitch.tv/helix/eventsub/subscriptions` with webhook transport on port 443.

See curl examples in [05-ingestion-per-platform.md](../05-ingestion-per-platform.md).

## References

- https://dev.twitch.tv/docs/eventsub/manage-subscriptions/
- https://dev.twitch.tv/docs/api/guide
- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow
