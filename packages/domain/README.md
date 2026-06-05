# @omnicharts/domain

Shared domain types and constants for OmniCharts. **Zero runtime dependencies.**

## Exports

| Module             | Contents                                                    |
| ------------------ | ----------------------------------------------------------- |
| `PlatformId`       | Data/API platform identifiers (`twitch`, `kick`, `youtube`) |
| `UiPlatformFilter` | UI filter including `all`                                   |
| `RankingPeriod`    | Ranking windows (`24h`, `7d`, `30d`, `90d`)                 |
| `IngestState`      | Channel ingest lifecycle states                             |
| Constants          | Platform IDs, default ranking period, ingest state list     |

## Usage

```ts
import { PLATFORM_TWITCH, parseRankingPeriod, type PlatformId } from '@omnicharts/domain';
```

## Scripts

```bash
bun run check   # tsc --noEmit
bun test        # unit tests
```

## Docs

- Platform IDs: `migrations/d1/0001_init_schema.sql`
- Ingest states: [docs/12-channel-discovery-and-tracking.md](../../docs/12-channel-discovery-and-tracking.md)
- Ranking periods: [docs/07-api-spec.md](../../docs/07-api-spec.md)
