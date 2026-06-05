# Project scaffold and commands

**Purpose:** CLI commands for OmniCharts implementation, each tied to **official documentation**. Do not hand-create SvelteKit/Worker boilerplate.

**Citation rule:** When adding or changing commands, link the primary source and update the [Correction log](#correction-log). Agents: follow [20-documentation-standards.md](./20-documentation-standards.md) — **this file is the only full CLI SSOT**.

Related: [11-cloudflare-deployment.md](./11-cloudflare-deployment.md) · [06-storage-and-rollup-design.md](./06-storage-and-rollup-design.md) · [ROADMAP.md](../ROADMAP.md)

---

## Official references (canonical)

| Topic | Source | Why we use it |
|-------|--------|----------------|
| **Create SvelteKit app** | [Creating a project](https://svelte.dev/docs/kit/creating-a-project) | Official entry: `npx sv create` (not legacy `npm create svelte`) |
| **Svelte CLI (`sv`)** | [CLI overview](https://svelte.dev/docs/cli/overview) · [`sv create`](https://svelte.dev/docs/cli/sv-create) · [`sv add`](https://svelte.dev/docs/cli/sv-add) | Non-interactive flags and add-ons |
| **Cloudflare adapter add-on** | [sveltekit-adapter](https://svelte.dev/docs/cli/sveltekit-adapter) | Add-on name is **`sveltekit-adapter`**, option `adapter:cloudflare` — not `cloudflare` |
| **Cloudflare adapter package** | [adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare) | `platformProxy` for local D1; build dir `.svelte-kit/cloudflare` |
| **Deploy SvelteKit on Pages** | [Cloudflare: Deploy a SvelteKit site](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/) | C3 alternative; build output dir |
| **D1 + Pages local** | [D1 local development (Pages)](https://developers.cloudflare.com/d1/best-practices/local-development/#develop-locally-with-pages) | `preview_database_id = "DB"` must match binding name |
| **D1 migrations** | [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) | Shared `migrations_dir` for web + ingest |
| **Wrangler CLI** | [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) | `npx wrangler` for D1, Pages, Workers, Queues |
| **Create Worker (ingest)** | [D1 get started — Create a Worker](https://developers.cloudflare.com/d1/get-started/#1-create-a-worker) | C3 for ingest (Workers default, not Pages) |
| **Queues** | [Queues get started](https://developers.cloudflare.com/queues/get-started/) | Queues must exist before `wrangler deploy` with queue bindings |

**Context7 validation (2026-06-01):** `/websites/svelte_dev_kit` — adapter-cloudflare `wrangler pages dev .svelte-kit/cloudflare`, `platformProxy`, build output.

---

## Layout: lightweight monorepo

| Path | Created by |
|------|------------|
| `apps/web/` | [`npx sv create`](https://svelte.dev/docs/kit/creating-a-project) + [`sveltekit-adapter`](https://svelte.dev/docs/cli/sveltekit-adapter) |
| `workers/ingest/` | [`npm create cloudflare@latest`](https://developers.cloudflare.com/d1/get-started/#1-create-a-worker) or [`wrangler init`](https://developers.cloudflare.com/workers/wrangler/commands/#init) |
| `packages/domain`, `packages/rollup` | Manual `@omnicharts/*` workspace packages — see [27-monorepo-shared-packages.md](./27-monorepo-shared-packages.md) |
| `migrations/d1/` | [`wrangler d1 migrations`](https://developers.cloudflare.com/d1/reference/migrations/) |

```json
{
  "name": "omnicharts",
  "private": true,
  "workspaces": ["apps/*", "workers/*", "packages/*"]
}
```

---

## Prerequisites

- Node.js 20 LTS (for `bunx` / Wrangler)
- **Bun** (OmniCharts package manager — [install](https://bun.sh/docs/installation))
- [`bunx wrangler login`](https://developers.cloudflare.com/workers/wrangler/commands/#login)

**Package manager:** Use `bun` / `bunx` / `bun run` at repo root and in workspaces. [`sv create --install bun`](https://svelte.dev/docs/cli/sv-create) is supported.

**Monorepo imports:** [27-monorepo-shared-packages.md](./27-monorepo-shared-packages.md) — Pages use `@omnicharts/domain` + `@omnicharts/rollup`; ingest uses the same packages plus Worker-only code. Internal deps use `"workspace:*"`. Root scripts use `bun run --filter <name>` ([Bun workspaces](https://bun.com/docs/pm/workspaces), [bun --filter](https://bun.com/docs/pm/filter)).

---

## Step 0 — Root workspace

```bash
cd "/home/pyro1121/Documents/Stream Charts"
# Root package.json with workspaces: ["apps/*", "workers/*", "packages/*"] (see repo root)
mkdir -p apps workers packages migrations/d1
bun install   # after apps/web exists
```

---

## Step 1 — SvelteKit web (`apps/web`) — **`sv create`**

Per [Creating a project](https://svelte.dev/docs/kit/creating-a-project): *"The easiest way to start building a SvelteKit app is to run `npx sv create`"* — not `npm create svelte@latest` and not hand-built `src/routes` trees.

### 1a. Create the app

```bash
cd apps
npx sv create web
```

Interactive prompts ([`sv create` options](https://svelte.dev/docs/cli/sv-create)):

| Prompt | OmniCharts choice |
|--------|-------------------|
| Template | `minimal` or `demo` |
| Types | `ts` (TypeScript) |
| Add-ons | `sveltekit-adapter` → Cloudflare → Pages (see 1b) |
| Install dependencies | Yes (`bun`) |

**Non-interactive** (single command — Cloudflare Pages target):

```bash
cd apps
bunx sv create web --template minimal --types ts --install bun \
  --add sveltekit-adapter=adapter:cloudflare+cfTarget:pages
cd .. && bun install
```

**Why `sveltekit-adapter`:** The CLI has no add-on named `cloudflare`. Cloudflare is selected inside [sveltekit-adapter](https://svelte.dev/docs/cli/sveltekit-adapter) as `adapter:cloudflare` with optional `cfTarget:pages`.

### 1b. Add Cloudflare adapter (if not added at create)

**After create:**

```bash
cd web
npx sv add sveltekit-adapter=adapter:cloudflare+cfTarget:pages
```

**Manual** (always valid per [adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare)):

```bash
cd web
npm i -D @sveltejs/adapter-cloudflare
npm i -D wrangler
```

Then [adapter-cloudflare → Usage](https://svelte.dev/docs/kit/adapter-cloudflare#Usage) and Wrangler config (see Step 3).

### 1c. First run (Vite dev)

Per [Creating a project](https://svelte.dev/docs/kit/creating-a-project): *"`npm run dev` will then start the development server"* at **http://localhost:5173**.

```bash
cd web
npm run dev
```

With D1 configured in `apps/web/wrangler.jsonc` (`preview_database_id = "DB"`), the adapter’s **`platformProxy`** emulates `event.platform.env.DB` during `npm run dev` ([Testing locally](https://svelte.dev/docs/kit/adapter-cloudflare#Testing-locally)).

### 1d. Cloudflare preview (two flows)

**A — Day-to-day (Vite + local D1 via adapter)** — preferred:

```bash
cd apps/web
# wrangler.jsonc must include preview_database_id = "DB" (Step 3)
npm run dev
```

**B — Preview production build on Pages runtime:**

```bash
cd apps/web
npm run build
npx wrangler pages dev .svelte-kit/cloudflare
```

Optional CLI override if not in config: `npx wrangler pages dev .svelte-kit/cloudflare --d1 DB=<database_id>` ([Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)).

**Do not use** `npx wrangler pages dev -- npm run dev` — the `[COMMAND]` positional on `pages dev` is **deprecated** in Wrangler 4 ([`pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/pages/#pages-dev)).

**Pages build settings** ([Cloudflare SvelteKit guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/)):

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Build output directory | `.svelte-kit/cloudflare` |

---

## Alternative: Cloudflare C3 (optional)

[Cloudflare’s guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/) uses C3. Project name must follow the **first** `--`:

```bash
cd apps
npm create cloudflare@latest -- web --framework=svelte --platform=pages
```

**Why `--platform=pages`:** Without it, C3 scaffolds **Workers** SvelteKit ([Workers Svelte guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/)), not Pages + `pages_build_output_dir`.

**OmniCharts default:** `npx sv create` (Step 1) for Svelte-official flow; C3 when you want one Cloudflare-centric wizard.

---

## Step 2 — Ingest Worker (`workers/ingest`)

Separate Worker ([11-cloudflare-deployment.md](./11-cloudflare-deployment.md)), not SvelteKit.

**Via C3** ([Create a Worker](https://developers.cloudflare.com/d1/get-started/#1-create-a-worker)) — **do not** pass `--platform=pages`:

```bash
cd workers
npm create cloudflare@latest -- ingest
# Interactive: Hello World → Worker only → TypeScript → git → deploy no
```

**Via Wrangler** ([`wrangler init`](https://developers.cloudflare.com/workers/wrangler/commands/#init)):

```bash
mkdir -p workers/ingest && cd workers/ingest
npx wrangler init -y
```

**Queues (once, before deploy with queue bindings):**

```bash
npx wrangler queues create omnicharts-ingest
npx wrangler queues create omnicharts-ingest-dlq
```

Source: [Queues get started](https://developers.cloudflare.com/queues/get-started/)

Add cron, queues, D1, R2 per [11-cloudflare-deployment.md](./11-cloudflare-deployment.md).

---

## Step 3 — D1 database + migrations

```bash
npx wrangler d1 create omnicharts
```

Record `database_id` from output.

**`apps/web/wrangler.jsonc`** (and mirror D1 binding on ingest):

```jsonc
{
  "name": "omnicharts-web",
  "compatibility_date": "2026-06-01",
  "pages_build_output_dir": ".svelte-kit/cloudflare",
  "d1_databases": [{
    "binding": "DB",
    "database_name": "omnicharts",
    "database_id": "<uuid-from-wrangler-d1-create>",
    "preview_database_id": "DB",
    "migrations_dir": "../../migrations/d1"
  }]
}
```

**Why `preview_database_id = "DB"`:** For Pages local dev, this value is the **binding name**, not a Cloudflare UUID ([D1 + Pages local](https://developers.cloudflare.com/d1/best-practices/local-development/#develop-locally-with-pages)).

**Migrations** — canonical cwd **`workers/ingest`** (ingest and Pages `wrangler.jsonc` both point at `../../migrations/d1`):

```bash
cd workers/ingest
npx wrangler d1 migrations create omnicharts init_schema
# edit ../../migrations/d1/0001_init_schema.sql per docs/06

npx wrangler d1 migrations apply omnicharts --local
# npx wrangler d1 migrations apply omnicharts --remote
```

From repo root (preferred):

```bash
bun run d1:migrate:local
bun run d1:migrate:remote
bun run d1:verify-schema          # after local apply — tables 0001–0006
bun run d1:verify-schema:remote   # pre-deploy / freeze gate G2
```

Since Wrangler 3.33+, `apply` without flag defaults to **local** ([D1 release notes](https://developers.cloudflare.com/d1/platform/release-notes/)).

---

## Step 4 — Add OmniCharts routes (Phase 2+)

Pages under `apps/web/src/routes/` ([SvelteKit routing](https://svelte.dev/docs/kit/routing)) — extend scaffold, do not recreate app.

See [09-ui-routes-and-components.md](./09-ui-routes-and-components.md).

---

## Command cheat sheet (with sources)

Root monorepo scripts live in `package.json`. **Verify / test gates:** [13-testing-and-verification.md](./13-testing-and-verification.md) (SSOT — do not duplicate here).

| Task | Command | Source |
|------|---------|--------|
| **Create SvelteKit app** | `cd apps && npx sv create web` | [Creating a project](https://svelte.dev/docs/kit/creating-a-project) |
| **Add Cloudflare (Pages)** | `cd web && npx sv add sveltekit-adapter=adapter:cloudflare+cfTarget:pages` | [sveltekit-adapter](https://svelte.dev/docs/cli/sveltekit-adapter) |
| **Create + adapter (one shot)** | `npx sv create web … --add sveltekit-adapter=adapter:cloudflare+cfTarget:pages` | [sv create](https://svelte.dev/docs/cli/sv-create) |
| **Dev (Vite + D1 proxy)** | `cd apps/web && npm run dev` | [adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare#Testing-locally) |
| **Alt: C3 Svelte Pages** | `npm create cloudflare@latest -- web --framework=svelte --platform=pages` | [CF SvelteKit guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/) |
| **Create ingest Worker** | `npm create cloudflare@latest -- ingest` | [D1 get started](https://developers.cloudflare.com/d1/get-started/#1-create-a-worker) |
| **Create queues** | `npx wrangler queues create omnicharts-ingest` (+ dlq) | [Queues](https://developers.cloudflare.com/queues/get-started/) |
| **Create D1** | `npx wrangler d1 create omnicharts` | [d1 create](https://developers.cloudflare.com/workers/wrangler/commands/d1/#d1-create) |
| **Migrate D1 (local)** | `bun run d1:migrate:local` (cwd `workers/ingest`) | [d1 migrations apply](https://developers.cloudflare.com/workers/wrangler/commands/d1/#d1-migrations-apply) |
| **Verify D1 schema** | `bun run d1:verify-schema` / `d1:verify-schema:remote` | [13-testing](./13-testing-and-verification.md) |
| **Preview built Pages** | `npm run build && npx wrangler pages dev .svelte-kit/cloudflare` | [adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare) |
| **Build** | `npm run build` | [adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare) |
| **Deploy Pages** | `npx wrangler pages deploy .svelte-kit/cloudflare --project-name=omnicharts-web` | [pages deploy](https://developers.cloudflare.com/workers/wrangler/commands/pages/#pages-deploy) |
| **Deploy ingest** | `cd workers/ingest && npx wrangler deploy` | [deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy) |
| **Ingest secrets** | `cd workers/ingest && npx wrangler secret put TWITCH_CLIENT_SECRET` | [secret put](https://developers.cloudflare.com/workers/wrangler/commands/workers/#secret-put) |

---

## Do / Don't

| Do | Don't |
|----|-------|
| [`npx sv create`](https://svelte.dev/docs/kit/creating-a-project) for `apps/web` | Hand-create `src/routes` without CLI |
| [`sveltekit-adapter=adapter:cloudflare`](https://svelte.dev/docs/cli/sveltekit-adapter) | `npx sv add cloudflare` (non-existent add-on) |
| `npm create cloudflare@latest -- <name> …` | Put project name before first `--` |
| `preview_database_id = "DB"` on Pages web toml | Use a random UUID for Pages local preview |
| `npm run dev` with adapter `platformProxy` for D1 | Rely on deprecated `pages dev -- npm run dev` |
| Cite official URLs when adding commands | Guess CLI names (`npm create svelte` as primary) |
| Separate `workers/ingest` | Poll Twitch in `+page.server.ts` |

---

## Correction log

| Date | Fix |
|------|-----|
| 2026-06-01 | **Primary SvelteKit scaffold:** `npx sv create` per [Creating a project](https://svelte.dev/docs/kit/creating-a-project). C3 optional only. |
| 2026-06-01 | **Audit v2.4:** `sv add cloudflare` → `sveltekit-adapter=adapter:cloudflare+cfTarget:pages`. C3/npm arg order. D1 `preview_database_id = "DB"`. Deprecated `pages dev -- npm run dev`. Queues create. Migrations from `apps/web`. Context7 + [20-documentation-standards.md](./20-documentation-standards.md). |
| 2026-06-01 | **Bun monorepo:** `--install bun`, root `bun install`, `bun run dev` in `apps/web`. |
| 2026-06-03 | Root scripts grouped; verify SSOT in doc 13; `d1:migrate:*` use `bun run --cwd workers/ingest`; added `test`, `verify:wrangler-production`. |
| 2026-06-03 | Lane 4/5: `packages/*` in layout; `wrangler.jsonc` (not TOML) for Pages; monorepo import link to doc 27. |
