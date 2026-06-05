# Auth, billing, and entitlements

## Current policy (launch)

| Capability | Entitlement |
|------------|-------------|
| Browse all public pages | Everyone |
| Rankings 7d / 30d | Everyone |
| Channel / game detail | Everyone |
| CSV export | Everyone (when built) |
| Public API | Everyone with key; generous limits |
| Custom date ranges | Preset 7d/30d/90d within retention (custom ranges Phase 6+) |
| Chat / subs / geo | Everyone when implemented (no PRO gate) |

**Revenue:** donations only (Ko-fi, GitHub Sponsors, or similar — link in footer).

---

## Future gating (only if costs force it)

Candidate **paid** features (not decided):

| Feature | Why it might cost |
|---------|-------------------|
| API &gt; 10k req/day | Worker + D1 load |
| 365d+ retention export | R2 egress |
| Agency seats / SSO | Support burden |
| Webhook push notifications | Infra |

**Never paywall:** basic rankings, 30d charts, streamer looking up own channel.

---

## Accounts (Phase 6+)

| Feature | Needs login? |
|---------|--------------|
| API key management | Yes |
| Saved channel lists | Yes |
| Agency watchlists | Yes |
| Claim channel (verify ownership) | Optional |

Use magic link or OAuth (Twitch only for verify) — minimize password surface.

---

## Donations

- Footer CTA: “Support OmniCharts”
- Transparent costs page (optional): hosting estimate, API quota usage
- No dark patterns; no “disable adblock” (we may run minimal ethical ads later — default **no ads**)

---

## Legal pages (before public launch)

- Terms of Service
- Privacy Policy (what we store: samples, IPs in logs)
- DMCA / takedown contact

---

## Entitlement matrix (reference)

| Feature | Guest | Free account | Paid (future) |
|---------|-------|--------------|---------------|
| Homepage rankings | ✓ | ✓ | ✓ |
| 30d channel history | ✓ | ✓ | ✓ |
| 90d history | — | ✓ | ✓ (Phase 4+) |
| API 300 rpm | — | ✓ | higher |
| Priority ingest for claimed channel | — | ✓ | ✓ |
