# Web performance audit

Measurable targets aligned with [16-search-and-resolution.md](../16-search-and-resolution.md) and SvelteKit [performance](https://svelte.dev/docs/kit/performance) guidance (2025).

## Changes (lane summary)

| Lane | Change | Expected Lighthouse / UX win |
|------|--------|------------------------------|
| Fonts | Non-blocking Google Fonts (`preload` + `onload` → stylesheet), trimmed weights, `font-display: swap` via `display=swap` | Faster FCP; text visible during font load (no FOIT) |
| Cache | `applyRollupPageCache` / `applySearchPageCache` on all rollup + search `load` | CDN/browser reuse; search `private, max-age=30` per doc 16 |
| CLS | `AvatarImage` fixed dimensions + `decoding="async"`; chart section `min-h-[200px]`; lazy chart chunk | Stable layout for avatars and chart area |
| Bundle | `manualChunks` vendor bucket; dynamic `import()` for `ViewershipChart` on channel page | Smaller initial JS on `/` and listings |
| SSR | Search `+page.server.ts` cache headers; chart data still from server `load` | Correct cache semantics on navigations |

## Verify

See [13-testing-and-verification.md § Lighthouse smoke](../13-testing-and-verification.md#lighthouse-smoke). Commands:

```bash
bun run check:web
bun run test:web
bun run build:web
bun run lighthouse:smoke
```

Implementation: `scripts/verify/lighthouse-smoke.ts`.

### Perf budgets (`lighthouse:smoke`)

Audits `/` on preview (`127.0.0.1:4173`) after production build. Override via env:

| Category | Default min score |
|----------|-------------------|
| performance | 75 |
| accessibility | 90 |
| best-practices | 90 |
| seo | 90 |

Autoresearch loop fails if any budget missed. Raise `LH_MIN_PERFORMANCE` etc. only with doc update.

Optional manual: `bun run dev:web`, audit `/` and `/channels/<slug>` with mobile throttling.

## Out of scope (other agent)

- `wrangler.jsonc`, `svelte.config.js` adapter / `platformProxy`
- Immutable `/_app/*` long-cache headers (Pages / CDN layer)
