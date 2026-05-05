# Debug: Phase 6 Testing Completion

## Cíl

Dotáhnout Phase 6 Testing checklist do spustitelného stavu bez ruční review smyčky.

## Přidané testy

### Server

- `apps/server/src/utils/chat-search-cache.test.ts`
  - deterministické cache key řazení participantů,
  - nemutování vstupního pole,
  - oddělení podle vieweru a query,
  - invalidation pattern prefix.
- `apps/server/src/routes/chat.integration.test.ts`
  - `GET /api/chat/messages/search` Redis `HIT`,
  - `GET /api/chat/messages/search` Redis `MISS` + `setCachedJson(..., 30)`,
  - `POST /api/chat/messages` invaliduje search cache pro DOM/SUB participanty.

### Web

- `apps/web/src/lib/tasks/ids.test.ts`
  - `public_task_id` preference,
  - legacy fallback suffix,
  - DB lookup column podle UUID/public id formátu.
- `apps/web/e2e/login.spec.ts`
  - login page render smoke,
  - forgot-password link,
  - empty credentials validation.
- `apps/web/playwright.config.ts`
  - Chromium project,
  - production `next start` webServer,
  - testovací public Supabase env fallbacky.

### Chrome Extension

- `apps/chrome-extension/src/shared/sync-backoff.test.ts`
  - no-backoff sync allowed,
  - first failure retry delay,
  - clear flow.
- `apps/chrome-extension/src/shared/event-buffer.test.ts`
  - duplicate event replacement,
  - sync batch cap 100 events,
  - removal jen pro přesně shodný synced payload.
- `apps/chrome-extension/test/chrome-storage.ts`
  - minimální `chrome.storage.local` mock pro unit testy.

## Ověření

- `pnpm --filter server test` -> prošlo, 2 test files / 6 testů.
- `pnpm --filter web test:unit` -> prošlo, 1 test file / 3 testy.
- `pnpm --filter chrome-extension test` -> prošlo, 2 test files / 5 testů.
- `pnpm --filter web exec playwright install chromium` -> Chromium runtime stažený lokálně.
- `pnpm --filter web test:e2e` -> prošlo, 2 Playwright testy.
- `pnpm test` -> prošlo, Turbo 7/7 tasks successful.

## Poznámky

- Playwright E2E běží proti `next start`, takže `test:e2e` před spuštěním dělá `pnpm build`.
- Root `pnpm test` tím pádem buildí web v Turbo dependency a potom ještě jednou v `web` test scriptu pro přímou spustitelnost `pnpm --filter web test:e2e`.
- Turbo po root `pnpm test` jednou vypsal warning `Invalid file path` pro Next `.next/static/...` symlink. Exit code byl `0` a všechny tasks byly successful.
- Pokrytí je Phase 6 foundation/smoke úroveň, ne vyčerpávající pokrytí každého DOM/SUB workflow.
