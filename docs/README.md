# OmniCharts documentation index

**Version:** 2.8 (Phase 0–2 + freeze gate sync, 2026-06-03)

## Read order

1. [00-vision-and-principles.md](./00-vision-and-principles.md)
2. [01-competitive-parity-matrix.md](./01-competitive-parity-matrix.md)
3. [ROADMAP.md](../ROADMAP.md)
4. [19-project-scaffold-and-commands.md](./19-project-scaffold-and-commands.md) — **run before Phase 1 code** (CLI SSOT)
5. [20-documentation-standards.md](./20-documentation-standards.md) — citation rules for agents
6. [12-channel-discovery-and-tracking.md](./12-channel-discovery-and-tracking.md)
7. [05-ingestion-per-platform.md](./05-ingestion-per-platform.md) + [adr/](./adr/)
8. [06-storage-and-rollup-design.md](./06-storage-and-rollup-design.md)
9. [11-cloudflare-deployment.md](./11-cloudflare-deployment.md)
10. [16-search-and-resolution.md](./16-search-and-resolution.md)
11. [09-ui-routes-and-components.md](./09-ui-routes-and-components.md)
12. [17-methodology-page.md](./17-methodology-page.md)
13. [18-legal-and-compliance-checklist.md](./18-legal-and-compliance-checklist.md)
14. [13-testing-and-verification.md](./13-testing-and-verification.md)
15. [14-observability-slos-and-error-budgets.md](./14-observability-slos-and-error-budgets.md)
16. [15-ingest-runbook.md](./15-ingest-runbook.md)
17. [07-api-spec.md](./07-api-spec.md) + [openapi/v1.yaml](../openapi/v1.yaml)

## Phase 1 scaffold

**Do not duplicate commands here.** Run [19-project-scaffold-and-commands.md](./19-project-scaffold-and-commands.md) Steps 0–3 end-to-end.

## Version history

| Version | Focus |
|---------|--------|
| 2.0 | Cloudflare, ingest, ADRs, MVP phasing |
| 2.1 | Search, methodology, legal, OpenAPI |
| 2.2 | Kick + YouTube ingest depth; doc 19 CLI scaffold |
| 2.3 | Fix: `npx sv create` as primary SvelteKit scaffold; citations required |
| 2.4 | Deep audit: `sveltekit-adapter`, C3 arg order, D1 preview id, Twitch/Kick/YouTube curl; [20](./20-documentation-standards.md) |
| 2.5 | Twitch Phase 1 ingest: [21](./21-twitch-ingest-libraries.md), Helix client in `workers/ingest` |
| 2.6 | Web UI shell: [22](./22-ui-design-system.md), `apps/web` (Tailwind + layout components) |
| 2.7 | Pre–Kick remediation backlog: [23](./23-audit-remediation-plan.md); freeze gate `bun run verify:twitch` |
| 2.8 | Phase 0–2 shipped; freeze G1/G2 done — [26](./26-twitch-freeze-execution-plan.md); audit doc map in [23](./23-audit-remediation-plan.md#audit-doc-map-no-duplicate-reading) |

## Pre–Kick audits (read one role)

| Doc | Role |
|-----|------|
| [23](./23-audit-remediation-plan.md) | REM backlog + G1–G12 |
| [24](./24-remediation-grounding-audit.md) | Phase 0–2 operational matrix |
| [26](./26-twitch-freeze-execution-plan.md) | Gate status + next tasks |
| [audits/cloudflare-hardening-complete](./audits/cloudflare-hardening-complete.md) | Current CF hardening |
| [audits/cloudflare-free-tier-audit](./audits/cloudflare-free-tier-audit.md) | Baseline limits (historical) |

## ADRs

| ADR | Topic |
|-----|-------|
| [0002](./adr/0002-twitch-eventsub-vs-polling.md) | Twitch lifecycle vs metrics |
| [0006](./adr/0006-twitch-pagination-coverage.md) | Helix pagination: sweep + game + reconcile |
| [0003](./adr/0003-kick-ingest-strategy.md) | Kick official API |
| [0004](./adr/0004-cloudflare-free-vs-paid.md) | Hosting cost tier |
