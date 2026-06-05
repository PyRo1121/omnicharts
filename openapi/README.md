# OpenAPI

| File | Status |
|------|--------|
| [v1.yaml](./v1.yaml) | **Implemented subset** — matches ingest Worker `GET /v1/*` (Twitch Phase 2) |

**Live routes (ingest Worker):**

- `GET /v1/rankings/channels` — periods `24h` \| `7d` \| `30d` \| `90d`; `peak_viewers` / `airtime_hours` from rollups
- `GET /v1/rankings/games`
- `GET /v1/channels/{slug}` — channel detail + daily series
- `GET /v1/channels/resolve?slug=` — canonical slug + `slug_history` (web 301)
- `GET /v1/games/{slug}`
- `GET /v1/search/channels` — response `{ results: [...] }`

**Not in spec (deferred):** `/overview`, `/channels/{slug}/streams`, API keys (Phase 6), Kick/YouTube data.

Web proxies: `apps/web/src/routes/api/v1/*`.

**Lint (CI):** `.github/workflows/verify-twitch.yml` runs `npx @redocly/cli lint openapi/v1.yaml --config openapi/redocly.yaml` on every PR (OAS 3.1 `struct`; security/tag rules deferred — see `openapi/redocly.yaml`).

Local:

```bash
npx @redocly/cli lint openapi/v1.yaml --config openapi/redocly.yaml
```
