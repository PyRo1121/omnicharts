# Non-goals and risks

## Non-goals

| Item | Reason |
|------|--------|
| Scraping Streams Charts or Esports Charts | Legal + ethical; not our data source |
| Reselling Jazz API under OmniCharts brand | Dependency + cost |
| 15 platforms at launch | Scope; Twitch+Kick+YouTube first |
| 35 tools at launch | Build rankings first; tools in Phase 6+ |
| Editorial newsroom | Not core to data product |
| Sponsorship marketplace | Different product |
| Mobile native apps | Web-first |
| Real-time chat moderation | Out of scope |
| Claiming “largest database” on day one | Misleading |

---

## Technical risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Twitch API rate limits | High | Ingest gaps | Queues, tiered tracking, backoff |
| YouTube quota exhaustion | High | Stale YouTube data | Cache, fewer tracked channels, quota request |
| Kick API limits / hidden viewers | Medium | Incomplete Kick data | ~1 req/s; batch ≤50 IDs; UI "—"; [ADR-003](./adr/0003-kick-ingest-strategy.md) |
| Kick discovery coverage gap | Medium | Miss long-tail channels | Category-scoped discovery only; no full directory |
| Kick Schedule 1 / long-term storage | Medium | Legal exposure | Counsel before beta; aggregates not raw resale |
| Cloudflare Free tier ingest | High | Stale/broken ingest | **Workers Paid** for production ([ADR-004](./adr/0004-cloudflare-free-vs-paid.md)) |
| D1 size limits on free tier | Medium | Cannot keep 365d all samples | Aggressive rollup + R2 cold store |
| Cloudflare Worker CPU time | Medium | Slow rollups | Batch in Queues; precompute nightly |
| Slug changes / rebrands | Medium | Broken links | Store `platform_channel_id`; redirect table |

---

## Legal and compliance risks

| Risk | Mitigation |
|------|------------|
| Trademark “Streams Charts” | Use **OmniCharts** only |
| Platform ToS violation | Official APIs; legal review for Kick scraping if ever considered |
| GDPR / privacy | Minimal PII; no chat log storage without policy |
| Hotlinking platform CDNs | Cache avatars to R2 if ToS requires |

---

## Product risks

| Risk | Mitigation |
|------|------------|
| Numbers disagree with incumbents | Methodology page; show `tracked_since` |
| Users expect 2019 history | Clear copy: history grows from ingest start |
| Free tier abuse (API) | Rate limits, no scraping in ToS |
| Solo maintainer burnout | Ruthless MVP scope; docs for AI assist |

---

## Security (baseline)

- Secrets only in Wrangler / env, never in repo
- CSRF on mutating routes when auth exists
- API keys hashed at rest
- Admin ingest routes behind Cloudflare Access or secret path

---

## Open questions

| Question | Owner | Resolve by |
|----------|-------|------------|
| Kick official API readiness | Dev | Phase 3 start |
| Domain name | User | Before beta |
| License (MIT vs AGPL) | User | Before open-source release |
| Donation provider | User | Phase 2 UI |
