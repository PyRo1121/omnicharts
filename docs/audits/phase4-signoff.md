# Phase 4 sign-off (retention & agency)

**Date:** 2026-06-05  
**Maintainer:** agent sign-off after full gate run  
**Related:** [ROADMAP Phase 4](../../ROADMAP.md#phase-4--retention--agency-weeks-1114) · [28-phase4-plan](../28-phase4-plan.md)

---

## Shipped scope

| Slice | Feature | Status |
|-------|---------|--------|
| 4.1 | CSV export (rankings + channel detail) | Shipped |
| 4.2 | 90-day rollups + `90d` UI toggle | Shipped |
| 4.3 | R2 Parquet cold archive | Shipped |
| 4.4 | 2-channel compare (`/compare` + API) | Shipped |
| 4.5 | Agency CSV watchlist import | Shipped |
| 4.6 | Twitch VOD metadata backfill | Shipped |
| 4.7 | Language filter on rankings + search | Shipped |

---

## Verification gates (2026-06-05)

All run from repo root unless noted.

| Gate | Command | Result |
|------|---------|--------|
| Lint | `bun run lint` | **PASS** |
| Format | `bun run format:check` | **PASS** |
| Ingest unit | `bun run test:ingest` | **PASS** 582/582 |
| Packages | `bun run check:packages` | **PASS** |
| Web types | `bun run check:web` | **PASS** |
| Web unit | `bun run test:web` | **PASS** 98/98 |

Phase 3 platform gates (`verify:kick`, `verify:youtube`) remain valid with documented SKIP/deferrals per [phase3-signoff](./phase3-signoff.md).

---

## Exit criteria (ROADMAP Phase 4)

| Criterion | Status |
|-----------|--------|
| 90d retention (rollups + UI) | **Met** |
| CSV export | **Met** |
| 2-channel compare | **Met** |
| Agency watchlist import | **Met** |
| VOD backfill | **Met** |
| Language filter | **Met** |
| R2 cold path (opt-in `COLD_ARCHIVE_ENABLED`) | **Met** |

---

## Known ops deferrals (not Phase 4 blockers)

| Item | Deferral |
|------|----------|
| `COLD_ARCHIVE_ENABLED=1` in production | Enable per [23-paid-tier-zero-overage-playbook](../23-paid-tier-zero-overage-playbook.md) when ready |
| Homepage table CSV export (4.1b) | Deferred per [28-phase4-plan](../28-phase4-plan.md) |
| Public API keys / rate limits | Phase 6 |

---

## Exit

**Phase 4 complete** per [ROADMAP](../../ROADMAP.md). Phase 5 (Cloudflare production deploy) may proceed.
