# Cache manager key format

> **Shard:** `cache-keys`

Build keys via `src/shared/lib/cacheKeyFormat.ts`; segments joined with `:`.

| Segment | Width | Example |
|---------|-------|---------|
| domain | 6 | `sess--`, `edge--` |
| kind | 4 | `ctx-`, `GET-` |
| tail | 10 each | `42--------` |

- Pad shorter values with `-` inside width.
- Abbreviate long tokens (`session` → `sess`).
- Overflow: `prefix-hash` within fixed width.
- **Omit unused segments** — no empty placeholders.
- Invalidation: `buildCacheKeyPrefix()` / `*_CACHE_PREFIX` constants.
- Prefixes from `buildCacheKeyPrefix` **already end with `:`** — `invalidateByPrefix` must match with `startsWith(prefix)`, not `startsWith(prefix + ':')`.

## Platform auth / session keys

| Domain | Kind | Example | Module |
|--------|------|---------|--------|
| session | ctx3 | `session:ctx3:42--------` | `sessionContextCache.ts` |
| role | attrs → `attr` | `role---:attr:AGENT-----` | `roleAttributesCache.ts` |
| user | role | `user---:role:42--------` | `userRolesCache.ts` |

Session context and user→role membership are warmed at login; read paths (`/api/auth/me`, edge sandbox, MCP) must use cache getters (`getSessionContextForUser`, `getUserRolesForRequest`) — not force-rebuild helpers — until invalidation or TTL (24h).

**IDs:** `platform.cache.key-format`.
