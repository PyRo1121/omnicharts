# OmniCharts

**Open, cross-platform live streaming analytics** — built for streamers, agencies, and API consumers. No paywalls at launch; funded by donations until operating costs require optional paid tiers.

OmniCharts is an independent product inspired by the *category* of tools like [Streams Charts](https://streamscharts.com/). We do **not** scrape or resell third-party analytics databases. All metrics are derived from **official platform APIs** and **our own continuous ingestion** (see [docs/05-ingestion-per-platform.md](./docs/05-ingestion-per-platform.md)).

## Status

| Phase | Focus |
|-------|--------|
| **Done** | Phase 0–2 — docs SSOT, Twitch ingest + rollups, discovery loop UI (homepage, channel, game, overview, methodology) |
| **Now** | Twitch freeze gate (G3 prod vars, G11–G12 sign-off) — [26-twitch-freeze-execution-plan](./docs/26-twitch-freeze-execution-plan.md) |
| **Next** | Phase 3 — Kick + YouTube ([ROADMAP](./ROADMAP.md)) |
| **Later** | Public API (Phase 6), extended retention (Phase 4+) |

## Stack (target)

| Layer | Choice |
|-------|--------|
| UI | [SvelteKit](https://kit.svelte.dev/) + TypeScript |
| Tooling | [Bun](https://bun.sh/) workspaces (`apps/*`, `workers/*`) |
| App data | SQLite (local dev) → [Cloudflare D1](https://developers.cloudflare.com/d1/) (prod) |
| Analytics rollups | DuckDB over Parquet (local/batch) → precomputed tables in D1/R2 (prod) |
| Hosting | Cloudflare Pages + Workers; **Paid Workers** for production ingest ([ADR-004](./docs/adr/0004-cloudflare-free-vs-paid.md)) |

## Documentation index

Read in order for onboarding:

| Doc | Purpose |
|-----|---------|
| [docs/00-vision-and-principles.md](./docs/00-vision-and-principles.md) | Mission, constraints, success criteria |
| [docs/01-competitive-parity-matrix.md](./docs/01-competitive-parity-matrix.md) | Competitors + Streams Charts homepage MVP |
| [docs/02-user-personas-and-journeys.md](./docs/02-user-personas-and-journeys.md) | Streamers, agencies, API users |
| [docs/03-domain-model.md](./docs/03-domain-model.md) | Entities and relationships |
| [docs/04-metrics-glossary.md](./docs/04-metrics-glossary.md) | Definitions and formulas |
| [docs/05-ingestion-per-platform.md](./docs/05-ingestion-per-platform.md) | Twitch, Kick, YouTube APIs + history limits |
| [docs/06-storage-and-rollup-design.md](./docs/06-storage-and-rollup-design.md) | SQLite, DuckDB, Cloudflare mapping |
| [docs/07-api-spec.md](./docs/07-api-spec.md) | Public REST API (OmniCharts) |
| [docs/08-auth-billing-entitlements.md](./docs/08-auth-billing-entitlements.md) | Free-first; future gating |
| [docs/09-ui-routes-and-components.md](./docs/09-ui-routes-and-components.md) | SvelteKit routes and UI map |
| [docs/10-non-goals-and-risks.md](./docs/10-non-goals-and-risks.md) | Legal, scope, pitfalls |
| [docs/11-cloudflare-deployment.md](./docs/11-cloudflare-deployment.md) | Workers, D1, R2, cron ingest |
| [docs/12-channel-discovery-and-tracking.md](./docs/12-channel-discovery-and-tracking.md) | Who we track and why |
| [docs/13-testing-and-verification.md](./docs/13-testing-and-verification.md) | Tests and MVP gates |
| [docs/14-observability-slos-and-error-budgets.md](./docs/14-observability-slos-and-error-budgets.md) | SLOs, `/health` |
| [docs/15-ingest-runbook.md](./docs/15-ingest-runbook.md) | Ops playbook |
| [docs/16-search-and-resolution.md](./docs/16-search-and-resolution.md) | Search, slugs, redirects |
| [docs/17-methodology-page.md](./docs/17-methodology-page.md) | Public `/methodology` copy |
| [docs/18-legal-and-compliance-checklist.md](./docs/18-legal-and-compliance-checklist.md) | Legal pre-launch checklist |
| [docs/adr/](./docs/adr/) | Architecture decision records |
| [openapi/v1.yaml](./openapi/v1.yaml) | REST API draft (OpenAPI 3.1) |
| [docs/19-project-scaffold-and-commands.md](./docs/19-project-scaffold-and-commands.md) | **CLI scaffold** ([`npx sv create`](https://svelte.dev/docs/kit/creating-a-project), Wrangler D1) |

Roadmap: [ROADMAP.md](./ROADMAP.md) — **MVP complete = Phase 3** (three-platform discovery loop).

## Quick start (web)

```bash
bun install
bun run dev:web      # http://localhost:5173
bun run dev:ingest   # http://localhost:8787  (/health)
bun run test         # ingest + web unit tests
bun run check:web
bun run d1:migrate:local   # after schema changes
```

Verification gates: [docs/13-testing-and-verification.md](./docs/13-testing-and-verification.md) (`verify:twitch`, `twitch:freeze-proof`).

Scaffold details: [docs/19-project-scaffold-and-commands.md](./docs/19-project-scaffold-and-commands.md).

## MVP definition

**Homepage parity** with [streamscharts.com](https://streamscharts.com/) for **Twitch, Kick, and YouTube Gaming**, limited to metrics we can compute from our ingest:

- Platform switcher (3 platforms + “all” later)
- Channel search
- “Most watched streamers” (Hours Watched, default 7 days)
- “Top categories” (Average Viewers, default 7 days)
- Links into channel and game detail pages

Editorial news, sponsorship marketplace, and 10+ extra platforms are **out of MVP**. Phase 2 ships **Twitch-only** slice of the same loop; Phase 3 adds Kick + YouTube (see roadmap).

## History retention policy

| Stage | Retention | Notes |
|-------|-----------|--------|
| Launch | 30 days | Hot rollups in D1/SQLite |
| Growth | 90 days → 365 days | Expand as storage and ingest stabilize |
| Long-term | Since channel first seen **by OmniCharts** | “Full career” = forward capture + any platform-backfill allowed by APIs |

Platform APIs **do not** expose a competitor’s multi-year warehouse. See [docs/05-ingestion-per-platform.md](./docs/05-ingestion-per-platform.md#historical-data-reality-check).

## Contributing (solo for now)

1. Change docs when product decisions change — **docs lead code**.
2. Keep `docs/01-competitive-parity-matrix.md` statuses updated per phase.
3. Do not commit secrets (`.dev.vars`, API keys).

## License

TBD (recommend OSI-approved license before public launch).
