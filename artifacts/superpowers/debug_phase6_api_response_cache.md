# Debug: Phase 6 API Response Cache

## Kontext

Phase 6 Performance obsahuje `API response caching (Redis)`. V `apps/server` už existuje dependency `redis`, ale nebyl žádný sdílený cache helper ani použití v API routes.

## První bezpečný slice

Zvolený endpoint:

- `GET /api/chat/messages/search`

Důvod:

- je read-only,
- může být dražší při větší historii, protože prohledává zprávy po dávkách,
- odpověď je user-scoped,
- krátký TTL je přijatelný,
- cache se dá invalidovat při chat mutacích.

Endpointy, které záměrně nejsou cacheované v tomto slice:

- `GET /api/chat/messages` kvůli realtime feedu,
- `GET /api/chat/messages/unread` kvůli badge/read stavu.

## Implementace

- Přidaný `apps/server/src/utils/redis-cache.ts`.
- Redis je volitelný:
  - pokud `REDIS_URL` není nastavené, API jede bez cache,
  - pokud Redis spadne, cache chyby se logují a endpoint pokračuje bez cache.
- Chat search cache key zahrnuje:
  - viewer id,
  - normalizovaný query hash,
  - hash sorted participant ids.
- TTL: `30s`.
- Response header:
  - `X-Cache: HIT`,
  - `X-Cache: MISS`.
- Invalidation:
  - po vytvoření zprávy,
  - po reakci srdcem,
  - po smazání zprávy,
  - po označení zprávy jako přečtené.

## Ověření

- `pnpm --filter server build` -> prošlo.

## Runtime poznámka

Cache se aktivuje až s `REDIS_URL`. Bez něj je helper no-op a nemění chování API.
