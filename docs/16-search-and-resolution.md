# Search and channel resolution

How users find channels and games from the homepage search bar, `/search`, and direct URLs. Implements parity with Streams Charts global search (H3).

Related: [03-domain-model.md](./03-domain-model.md), [09-ui-routes-and-components.md](./09-ui-routes-and-components.md), [12-channel-discovery-and-tracking.md](./12-channel-discovery-and-tracking.md).

---

## Goals

| Goal | Priority |
|------|----------|
| Resolve exact platform login → channel page in one action | P0 |
| Tolerate minor typos in display names | P1 |
| Handle slug renames without broken bookmarks | P0 |
| Disambiguate same slug on different platforms | P0 |
| Surface “not tracked yet” honestly | P0 |

---

## Index design (D1 / SQLite)

### `channels` lookup columns

| Column | Indexed | Use |
|--------|---------|-----|
| `(platform_id, slug)` | UNIQUE | Canonical URL |
| `(platform_id, platform_channel_id)` | UNIQUE | API identity |
| `display_name` | FTS or normalized | Search |
| `display_name_normalized` | Optional | `lower(unaccent(display_name))` — implement when i18n needed |

### `search_channel_fts` (Phase 2 MVP — SQLite FTS5)

```sql
CREATE VIRTUAL TABLE search_channel_fts USING fts5(
  slug,
  display_name,
  platform_id UNINDEXED,
  channel_id UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- Keep in sync on channel insert/update via trigger or app layer
```

**Cloudflare D1:** FTS5 availability must be verified at implementation time. Fallback: `LIKE` on normalized prefix + slug exact match (documented below).

### `slug_history`

```sql
CREATE TABLE slug_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  UNIQUE(platform_id, old_slug)
);
CREATE INDEX idx_slug_history_lookup ON slug_history(platform_id, old_slug);
```

On slug change from platform API: insert row, update `channels.slug`, keep `platform_channel_id` stable.

---

## Resolution algorithm

### Input

- `query` — user string (trim, max 100 chars)
- `platform` — active tab: `twitch` | `kick` | `youtube` (required for autocomplete; optional on `/search`)

### Steps (ordered)

1. **Normalize query:** trim, collapse whitespace, strip leading `@`.
2. **Exact slug match** (case-insensitive per platform rules):
   - Twitch/Kick: lowercase login
   - YouTube: handle or `UC…` channel ID if matches pattern
3. **Slug history redirect:** if no row in `channels`, lookup `slug_history` → 301 to `new_slug`.
4. **Platform channel ID** if query looks like YouTube `UCxxxxxxxx`.
5. **FTS / prefix search** on `display_name` + `slug` (limit 10).
6. **Empty:** return suggestions from top HW last 7d (same platform) as “popular channels”.

### Pseudocode

```ts
function resolveChannel(query: string, platform: PlatformSlug): ResolveResult {
  const q = normalizeQuery(query);
  if (!q) return { type: 'empty' };

  const exact = findBySlug(platform, q);
  if (exact) return { type: 'found', channel: exact };

  const redirect = findSlugHistory(platform, q);
  if (redirect) return { type: 'redirect', to: redirect.new_slug };

  if (isYouTubeChannelId(q)) {
    const byId = findByPlatformId(platform, q);
    if (byId) return { type: 'found', channel: byId };
  }

  const candidates = searchFts(platform, q, 10);
  if (candidates.length === 1 && candidates[0].slug === q) {
    return { type: 'found', channel: candidates[0] };
  }
  return { type: 'suggestions', candidates };
}
```

---

## UX flows

### Homepage autocomplete (`ChannelSearch`)

| Event | Behavior |
|-------|----------|
| Focus, empty | Show 5 popular channels (platform tab) |
| Type ≥ 2 chars | Debounce 200ms → API `GET /api/v1/search/channels?q=&platform=` |
| Enter with single high-confidence match | Navigate `/channels/{slug}?platform=` |
| Enter with multiple | Navigate `/search?q=&platform=` |
| Click suggestion | Navigate channel page |

**High-confidence rule:** exact slug match OR single FTS result with score &gt; 2× second score.

### `/search` page (Phase 2)

- Query param `q`, `platform`
- List up to 25 results with avatar, display name, slug, HW (7d) if tracked
- Row click → channel page

### Direct URL `/channels/{slug}`

| Outcome | HTTP | UI |
|---------|------|-----|
| Found, tracked | 200 | Normal page |
| Found, `discovered` only | 200 | “We’re not tracking this channel yet” + optional “Request tracking” (future) |
| Slug history | 301 | Redirect to new slug |
| Not found | 404 | “Channel not found on {platform}” — do not leak other platforms’ matches |
| Wrong platform | 404 or suggest link | If slug exists on Kick but user on Twitch tab, show “Did you mean … on Kick?” |

---

## Game search (Phase 3)

- Index `game_categories (platform_id, slug, name)`.
- Route: `/games/{slug}?platform=`.
- Homepage does not require game autocomplete for MVP; channel search is H3.

---

## API endpoints (internal + public)

### Internal (SvelteKit `+server.ts`)

| Route | Purpose |
|-------|---------|
| `GET /api/v1/search/channels` | Autocomplete JSON |
| `GET /api/search/games` | Phase 3 |

### Public (Phase 6 — mirrors [07-api-spec](./07-api-spec.md))

`GET /v1/search/channels?q=&platform=&limit=`

---

## Fallback without FTS5 (D1)

**Performance note (P2 audit):** Current implementation uses `LIKE '%query%'` on `display_name` plus prefix match on `slug`. This is acceptable for MVP catalog size (&lt;100k tracked channels) but does not scale like FTS5 token search. Full-text index (`search_channel_fts`) remains Phase 4+; no code change until catalog growth warrants migration benchmarks.

```sql
SELECT c.* FROM channels c
WHERE c.platform_id = ?
  AND (
    lower(c.slug) = lower(?)
    OR lower(c.slug) LIKE lower(?) || '%'
    OR lower(c.display_name) LIKE '%' || lower(?) || '%'
  )
ORDER BY
  CASE WHEN lower(c.slug) = lower(?) THEN 0 ELSE 1 END,
  c.last_seen_at DESC
LIMIT 10;
```

Prefix `slug` match ranks above substring `display_name` match.

---

## Cross-platform same display name

Do not merge rows. Search results show **platform badge** per row. Two “Ninja” on Twitch vs YouTube = two results.

---

## Performance

| Target | Value |
|--------|-------|
| Autocomplete p95 | &lt; 150 ms (D1 indexed) |
| Cache | `Cache-Control: private, max-age=30` on search API |

---

## Testing

See [13-testing-and-verification.md](./13-testing-and-verification.md).

| Case | Expected |
|------|----------|
| Exact slug | 200 channel page |
| Old slug | 301 to new |
| Typo “shroud” vs “shroud_” | Suggestions, not wrong redirect |
| YouTube `UC…` ID | Resolves |
| Unknown | 404 + empty suggestions |

---

## Implementation checklist (Phase 2)

- [x] `slug_history` migration applied (`0001` + ingest slug sync)
- [x] Web + ingest: old slug → **301** to canonical slug ([REM-017](./23-audit-remediation-plan.md))
- [x] Platform-scoped search: autocomplete and `/search` pass active `platform` tab ([REM-020](./23-audit-remediation-plan.md))
- [x] `SearchChannels` / `/search?q=` shipped
- [ ] Sync job: on ingest metadata update, detect slug change (ongoing ingest maintenance)
- [ ] FTS5 / `search_channel_fts` — **deferred**; LIKE + indexes sufficient for MVP ([23 §4](./23-audit-remediation-plan.md#4-what-not-to-do-before-kick))
- [ ] 404 page copy approved in [17-methodology-page](./17-methodology-page.md) tone
