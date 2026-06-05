# ADR-0001: Record architecture decisions

## Status

Accepted

## Context

OmniCharts is solo-maintained. We need lightweight records of why major choices were made.

## Decision

Use numbered ADRs in `docs/adr/`:

- `0001` — this template
- `0002` — Twitch EventSub vs polling
- `0003` — Kick ingest
- `0004` — Cloudflare Free vs Paid

## Format

```markdown
# ADR-NNNN: Title
## Status
## Context
## Decision
## Consequences
```

## Consequences

- Agents read ADRs before changing ingest or hosting.
- Supersede by new ADR, not silent edits.
