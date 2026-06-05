# Documentation standards (agents & humans)

**Purpose:** One rulebook so implementers and coding agents run **correct, cited** commands. **Do not duplicate CLI blocks** outside [19-project-scaffold-and-commands.md](./19-project-scaffold-and-commands.md).

Related: [AGENTS.md](../AGENTS.md) · [19-project-scaffold-and-commands.md](./19-project-scaffold-and-commands.md)

---

## Docs lead code

When product, CLI, or platform contracts change:

1. Update the relevant doc (and **doc 19** if any shell command changes).
2. Add a row to doc 19 **Correction log** with date + official source.
3. Then change code.

---

## Single source of truth (SSOT)

| Topic | Canonical file |
|-------|----------------|
| **All scaffold / deploy shell commands** | [19-project-scaffold-and-commands.md](./19-project-scaffold-and-commands.md) |
| **Verify scripts** (`npm run check`, etc.) | [13-testing-and-verification.md](./13-testing-and-verification.md) |
| **Pre–Kick freeze (REM backlog, matrix, deps, execution)** | [audits/README](./audits/README.md) · [23-audit-remediation-plan](./23-audit-remediation-plan.md) · [24-remediation-grounding-audit](./24-remediation-grounding-audit.md) · [25-dependency-and-api-grounding](./25-dependency-and-api-grounding.md) · [26-twitch-freeze-execution-plan](./26-twitch-freeze-execution-plan.md) — **no duplicate verify bash blocks** outside doc 13 |
| **OpenAPI lint** | [openapi/README.md](../openapi/README.md) |
| **Ingest ops** (secrets, incidents, deploy checklist) | [15-ingest-runbook.md](./15-ingest-runbook.md) |
| **Bindings / anti-patterns** (toml shape, no DuckDB in Workers) | [11-cloudflare-deployment.md](./11-cloudflare-deployment.md) |
| **Schema + migration SQL** | [06-storage-and-rollup-design.md](./06-storage-and-rollup-design.md) |
| **Platform API paths / curl** | [05-ingestion-per-platform.md](./05-ingestion-per-platform.md) |
| **Phase checklists** | [ROADMAP.md](../ROADMAP.md) — link doc 19, **no abbreviated CLIs** |

**Forbidden:** New `bash` blocks in ROADMAP or `docs/README.md` that differ from doc 19. Use: “Run [doc 19 § Step N](./19-project-scaffold-and-commands.md#step-1--sveltekit-web-appsweb--sv-create).”

---

## Citation rules

Every **new or changed** command must include:

1. **Primary official URL** (Svelte, Cloudflare, Twitch dev, Kick docs, Google YouTube API).
2. **Why** in one sentence (e.g. “Helix requires `Client-Id` matching token client”).
3. **Context7** (optional but recommended for agents): after [resolve-library-id](https://github.com/upstash/context7), note library ID used when validating (e.g. `/websites/svelte_dev_kit` for adapter-cloudflare).

**Prefer:**

- `npx sv` / `npx wrangler` over bare `wrangler` / global installs.
- Full hosts in curl/HTTP examples (`https://id.twitch.tv`, not path-only).
- `npm create cloudflare@latest -- <dirname> …` — project name **after** first `--` ([C3](https://developers.cloudflare.com/pages/get-started/c3/)).

**Do not:**

- Use `npm create svelte@latest` as primary scaffold ([legacy](https://svelte.dev/docs/kit/creating-a-project)).
- Use `npx sv add cloudflare` — add-on is **`sveltekit-adapter`** ([sveltekit-adapter](https://svelte.dev/docs/cli/sveltekit-adapter)).
- Document `wrangler pages dev -- npm run dev` without deprecation note ([Wrangler `pages dev`](https://developers.cloudflare.com/workers/wrangler/commands/pages/#pages-dev)).

---

## Storage vocabulary (one glossary)

| Term | Meaning |
|------|---------|
| **SQLite file** | Fast unit tests / scripts on laptop; not Cloudflare prod |
| **D1 `--local`** | Miniflare DB via `wrangler d1 migrations apply … --local` |
| **D1 `--remote`** | Production D1; run from `apps/web` with correct `wrangler.toml` |
| **`preview_database_id = "DB"`** | Pages local D1: string **equals binding name**, not a Cloudflare UUID ([D1 + Pages local](https://developers.cloudflare.com/d1/best-practices/local-development/#develop-locally-with-pages)) |
| **DuckDB** | Local/batch validation over Parquet only — **never** Workers hot path ([06](./06-storage-and-rollup-design.md), [11](./11-cloudflare-deployment.md)) |

**Phase 1 default:** D1 local for Pages preview; SQLite file optional for pure logic tests (see doc 19 Step 3).

---

## Version policy

- **Node.js 20 LTS** — stated in doc 19 only.
- Pin versions in committed `package.json` / lockfiles, not in prose, unless security advisory.
- `@latest` on `npm create cloudflare@latest` is intentional (floating C3).

---

## Agent checklist (before claiming Phase 1 done)

1. Grep repo for new backtick commands; consolidate into doc 19.
2. Run commands from doc 19 in order; fix doc if CLI fails.
3. `bun run test:ingest && bun run test:web && bun run check:web && bun run build:web` when `apps/web` exists ([13](./13-testing-and-verification.md)).
4. `npx @redocly/cli lint openapi/v1.yaml` when touching API spec.
5. Mark planned scripts with `<!-- planned: path not in repo yet -->` in runbooks.

---

## Deep audit summary (2026-06-01)

Four parallel audits (official docs + Context7 `/websites/svelte_dev_kit`) found:

| Area | Verdict | Action taken |
|------|---------|--------------|
| `npx sv create` | Correct | Kept as primary |
| `npx sv add cloudflare` | **Wrong** | → `npx sv add sveltekit-adapter=adapter:cloudflare+cfTarget:pages` |
| C3 `npm create cloudflare@latest web -- --…` | **Wrong arg order** | → `npm create cloudflare@latest -- web --framework=svelte --platform=pages` |
| `preview_database_id` on Pages | Doc 11 had UUID placeholder | → `"DB"` per Cloudflare |
| `wrangler pages dev -- npm run dev` | Deprecated | → `npm run dev` + `platformProxy` / toml |
| `wrangler dev workers/ingest` | Invalid path | → `cd workers/ingest && npx wrangler dev` |
| Twitch `Client-Id`, `id.twitch.tv` token host | Missing in doc 05 | Added |
| Kick webhooks | Oversimplified OAuth | App token + `POST …/events/subscriptions` |
| YouTube examples | Path-only | Full `googleapis.com` + `part` |

Full command tables live in doc 19 correction log and [05-ingestion-per-platform.md](./05-ingestion-per-platform.md).

---

## Correction log (this doc)

| Date | Change |
|------|--------|
| 2026-06-01 | Initial standards + post-audit SSOT rules (v2.4 doc set) |
