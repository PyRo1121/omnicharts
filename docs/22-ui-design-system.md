# UI design system (OmniCharts web)

**Reference competitor:** [Streams Charts](https://streamscharts.com/) — dense analytics, platform filters, ranked tables, period selectors.

**OmniCharts differentiation:**

| Aspect | Streams Charts (avoid cloning) | OmniCharts |
|--------|-------------------------------|------------|
| Brand | “Streams Charts” wordmark | **OmniCharts** + chart-mark icon |
| Layout | Top nav + centered hero | **Left sidebar** + compact top bar |
| Accent | Purple/magenta marketing | **Teal** (data) + **amber** (highlights) |
| Type | Generic sans stack | **Sora** display + **Source Sans 3** body |
| Tables | Wide marketing home | **Card-contained** leaderboards, rank pills |
| Tone | Enterprise SaaS blurbs | Shorter labels; “open analytics” positioning |

**Implementation:** `apps/web/src/app.css` (tokens), `apps/web/src/lib/components/`.

**Rules for new pages:**

1. Use CSS variables (`--oc-*`) / Tailwind `@theme` tokens — no one-off hex in components.
2. New routes go inside `AppShell` (from `+layout.svelte`).
3. Tables use `LeaderboardTable`; platform scope uses `PlatformFilter`.
4. Mock data in `lib/mock/` until API routes exist.
