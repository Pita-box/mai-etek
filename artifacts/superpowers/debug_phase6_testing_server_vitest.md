# Debug: Phase 6 Testing - Server Vitest Foundation

## Cíl

Zahájit Phase 6 testing slice malým, ověřitelným krokem bez plošného přepisování test infrastruktury.

## Zjištění před změnou

- Root `package.json` má `test` script přes `turbo run test`.
- `turbo.json` má test pipeline, ale žádný workspace package zatím neměl vlastní `test` script.
- Nebyl nalezený existující `vitest.config.*`, `jest.config.*`, `playwright.config.*` ani test/spec soubor.
- `pnpm-lock.yaml` obsahoval jen nepřímé Playwright reference, ne projektově zavedený test runner.

## Změna

- Do `apps/server` byl přidaný `vitest` jako dev dependency.
- `apps/server/package.json` má nový script `test: vitest run`.
- Cache key logika pro chat search byla přesunutá do `apps/server/src/utils/chat-search-cache.ts`, aby šla testovat bez importu Express route a bez inicializace Supabase klienta.
- `apps/server/src/routes/chat.ts` používá nový helper pro:
  - `getSearchCacheKey(...)`,
  - `getSearchCacheInvalidationPattern(...)`.
- Přidaný test `apps/server/src/utils/chat-search-cache.test.ts` pokrývá:
  - deterministické řazení participantů,
  - nemutování vstupního pole participantů,
  - oddělení cache klíče podle vieweru,
  - oddělení cache klíče podle normalized query,
  - invalidation pattern prefix.
- `apps/server/tsconfig.json` vylučuje `src/**/*.test.ts`, aby se testy neemitovaly do `dist`.

## Ověření

- `pnpm --filter server test` -> prošlo, 1 test file / 3 testy.
- `pnpm --filter server build` -> prošlo.

## Zbývá

- API integration testy pro Express routes.
- Web unit/component testy pro rizikové helpery a klientské flows.
- E2E Playwright smoke pro hlavní DOM/SUB scénáře.
- Chrome Extension testování.
