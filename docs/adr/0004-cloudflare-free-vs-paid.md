# ADR-0004: Cloudflare Free for dev; Paid for production ingest

## Status

Accepted (2026-06-01)

## Context

OmniCharts needs 1–2 minute polling, Queues fan-out, and D1 writes for thousands of samples/day. Cloudflare Free Workers have 10 ms CPU, 10k Queue ops/day, 100k D1 writes/day.

## Decision

| Environment | Plan |
|-------------|------|
| Local | SQLite + Miniflare |
| CF staging (UI) | Free tier OK |
| CF production ingest | **Workers Paid** (~$5/mo minimum realistic) |
| Read path (Pages) | Free tier viable with CDN cache |

Do not market “real-time minute data at global scale” on Free ingest tier.

## Consequences

- Budget ~$5–20/mo for serious beta.
- Architecture stays serverless (no VPS fallback required).
- Sample pruning and rollup-first design still mandatory on Paid.

## References

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
