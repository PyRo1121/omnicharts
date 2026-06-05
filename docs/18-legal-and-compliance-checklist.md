# Legal and compliance checklist

**Status:** Pre-launch documentation. **Not legal advice.** Have a qualified attorney review before public beta, especially if operating in EU/UK (GDPR) or serving minors-heavy audiences.

Related: [10-non-goals-and-risks.md](./10-non-goals-and-risks.md), [17-methodology-page.md](./17-methodology-page.md).

---

## Launch blockers (must ship before public beta)

| Item | Route / artifact | Owner |
|------|------------------|-------|
| Privacy Policy | `/privacy` | Legal review |
| Terms of Service | `/terms` | Legal review |
| Platform attribution disclaimer | Footer on all pages | Product |
| Methodology page | `/methodology` | [17](./17-methodology-page.md) |
| Contact email | `/support`, footer | Ops |
| Cookie / analytics notice | Banner if using GA/GTM | Product |

---

## Platform developer compliance

### Twitch

| Requirement | Action |
|-------------|--------|
| Developer agreement | Accept [Twitch Developer Agreement](https://dev.twitch.tv/docs/terms-of-service/) |
| Trademark | Use [Twitch brand guidelines](https://www.twitch.tv/p/en/legal/trademark/); no implied endorsement |
| EventSub | HTTPS webhook; delete subscriptions when decommissioning app |
| Data retention | Store only what OmniCharts needs; document in Privacy Policy |
| `display_name` / avatars | Cache per API terms; link to Twitch CDN where allowed |

### Kick

| Requirement | Action |
|-------------|--------|
| Developer ToS | Accept [Kick Dev ToS](https://dev.kick.com/terms-of-service); §3.5 no scraping; §3.6 reasonable rate limits |
| API credentials | Register at [dev.kick.com](https://dev.kick.com/); client credentials server-side only |
| Data use | Schedule 1: no metadata resale/re-syndication; counsel on long-term aggregate retention |
| Rate limits | ~1 req/s default until published; 429 backoff in [15-ingest-runbook](./15-ingest-runbook.md) |
| Webhooks | HTTPS + `Kick-Event-Signature` if enabled |

### YouTube / Google

| Requirement | Action |
|-------------|--------|
| YouTube API Services Terms | Accept and comply with [YouTube API Services - Developer Policies](https://developers.google.com/youtube/terms/api-services-terms-of-service) |
| Google API Services User Data Policy | If storing any user OAuth data later, limited use disclosure |
| Quota | Monitor quota; no circumvention |
| Branding | [YouTube brand permissions](https://www.youtube.com/howyoutubeworks/resources/brand-resources/) |

---

## OmniCharts product policies (outline for ToS)

Include (attorney-drafted language):

1. **Service description** — statistics from public APIs; provided “as is.”
2. **No affiliation** — not Twitch, Kick, YouTube, Streams Charts, or Esports Charts.
3. **Acceptable use** — no scraping OmniCharts; no reselling bulk data without written agreement; rate limits on API.
4. **Account terms** — if/when accounts exist: one person per key, no sharing keys.
5. **Intellectual property** — OmniCharts UI and rollup database are ours; platform trademarks belong to platforms.
6. **User content** — if sponsorship marketplace ever added (out of scope v1): separate terms.
7. **Disclaimer of warranties** — metrics are estimates; not investment or contract advice.
8. **Limitation of liability** — standard caps (jurisdiction-specific).
9. **Termination** — suspend API abuse.
10. **Governing law** — TBD (user’s jurisdiction).

---

## Privacy Policy outline

### Data we collect

| Category | Examples | Purpose |
|----------|----------|---------|
| **Public platform data** | Channel names, slugs, viewer samples, stream titles | Core product |
| **Technical logs** | IP, User-Agent, request path | Security, abuse, SLOs |
| **Cookies** | Session, analytics (if enabled) | Functionality / analytics |
| **Account data** (future) | Email, API key hash | Auth |
| **Donations** (future) | Via Ko-fi / Stripe — we may not store payment details | Support |

### Data we do not collect (v1)

- Twitch chat message content (unless Phase 7+ chat analytics — update policy then)
- Passwords (use magic link / OAuth if added)
- Government IDs

### Legal bases (GDPR framing — for counsel)

- Legitimate interest for analytics publication of **public** broadcaster stats
- Consent for non-essential cookies
- Contract for registered API users

### Retention

| Data | Retention |
|------|-----------|
| Raw viewer samples (hot) | 14 days in D1 ([06](./06-storage-and-rollup-design.md)) |
| Daily rollups | Per product milestones (30d → 365d) |
| Server logs | 30–90 days |
| API keys | Until revoked + 30 days |

### Rights

- EU/UK: access, rectification, erasure, portability — **process** for personal data in logs/accounts
- Public channel stats may remain as aggregated historical facts — counsel to qualify

### Subprocessors

| Vendor | Use |
|--------|-----|
| Cloudflare | Hosting, D1, R2, CDN |
| (Future) Email provider | Magic links |
| (Future) Analytics | Plausible / GA — disclose |

### Children

Service not directed at under-13. Do not knowingly collect children’s data.

### International transfers

Cloudflare global network — Standard Contractual Clauses / DPA as applicable.

### Contact

`privacy@omnicharts.com` (placeholder)

---

## robots.txt and scraping

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/internal/
```

ToS should prohibit automated scraping that burdens infrastructure (separate from public API rate limits).

---

## DMCA / copyright

| Item | Action |
|------|--------|
| Designated agent | Register if US hosting and user-generated content — v1 may be low risk (no UGC uploads) |
| Takedown email | `legal@omnicharts.com` |
| Process | Remove or disable specific channel page on valid notice; document counter-notice flow |

Streamer avatars and names: identification only; respond to platform or rights-holder requests.

---

## Trademark — “OmniCharts” vs “Streams Charts”

| Do | Don’t |
|----|-------|
| Use **OmniCharts** consistently | Say “Streams Charts clone” in marketing |
| “Inspired by cross-platform analytics category” | Use their logos or trade dress |
| Compare features factually | Imply partnership with Esports Charts |

---

## Open source license (repo)

| Decision | Options |
|----------|---------|
| Application code | MIT / Apache-2.0 (TBD) |
| Data produced | **Not** open data by default — ToS restricts bulk redistribution |

Document in README before publishing repo publicly.

---

## Security and breach

- Encrypt secrets in Wrangler only
- No API keys in browser
- Incident response: rotate secrets, notify users if PII leaked (GDPR 72h if applicable)

---

## Pre-launch checklist

- [ ] Attorney review of `/terms` and `/privacy`
- [ ] Footer disclaimer on every page
- [ ] Platform developer apps registered (Twitch, Kick, YouTube)
- [ ] YouTube API compliance audit questionnaire (if required by Google)
- [ ] Replace placeholder emails (`support@`, `privacy@`, `legal@`)
- [ ] Cookie banner if analytics cookies used
- [ ] Data Processing Agreement with Cloudflare (enterprise if needed)
- [ ] Export / deletion procedure documented for future accounts

---

## Page stubs (content source)

Create minimal SvelteKit routes that render markdown from this repo or CMS later:

- `src/routes/privacy/+page.svelte` — expand Privacy outline above
- `src/routes/terms/+page.svelte` — expand ToS outline above

Until legal review, mark pages `noindex` or “Draft — not legal advice.”
